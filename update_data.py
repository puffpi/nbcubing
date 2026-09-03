import csv
import io
import json
import os
import shutil
import tempfile
import zipfile
from datetime import datetime

import requests


# ============================================================
# 基本配置
# ============================================================

WCA_EXPORT_API = "https://www.worldcubeassociation.org/api/v0/export/public"

OUTPUT_WCA = "wca_data.json"
OUTPUT_HISTORY = "history_data.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# ============================================================
# 宁波选手名单
# ============================================================

NB_IDS = [
    '2024GUOC01', '2024FENG08', '2023WANY03', '2018WANH02',
    '2016WUJI01', '2018HUAN49', '2019ZHOU88', '2025CHEJ08',
    '2026QIAN04', '2025HUAN11', '2025JIAN23', '2025WANB01',
    '2018ZHAX04', '2018SUNK01', '2024WANG52', '2025QING03',
    '2023CHEJ12', '2023CHEN30', '2018ZHAJ16', '2016HEZH01',
    '2018WANZ50', '2011HUAN10', '2018SHAO02', '2017DONG13',
    '2015CAIT01', '2017YANY06', '2021HUAN17', '2015ZHUJ05',
    '2018ZHUH05', '2017ZHUY03', '2014CHEN33', '2018WANH29',
    '2021WENZ02', '2026DING03', '2017PANL01', '2014LITI01',
    '2009FENG07', '2011YANX02', '2016ZHOU21', '2016ZHOU16',
    '2015LINX02', '2018GUOZ07', '2018ZHAO61', '2018WANG12',
    '2018GOUS01', '2018XIEN01', '2018XUSH07', '2018QIZI01',
    '2018LIHA15', '2018ZHAO59', '2018SHIY09', '2018LINY10',
    '2018ZOUZ02', '2018ZHAO62', '2017ZHOU10', '2015LIJI05',
    '2011FANG03', '2019CHEQ01', '2026JIAN17', '2016HEJI02',
    '2015FUYU01', '2026ZHEN08', '2025CHEN46', '2025SHEN26',
    '2025QIHA02', '2025HUAY04', '2024XULI01', '2025LIZH05',
    '2025WANG45', '2019CHEY56', '2019CHEN92', '2014ZHUC01',
    '2025LOUJ01', '2019GUAN18', '2024GUAN02', '2025WUBO02',
    '2024LUOK01', '2025ZHEN27', '2025SHEN27', '2025LICH03',
    '2025ZHAZ11', '2026ZHAN79', '2025TANW01'
]

NB_ID_SET = set(NB_IDS)


# ============================================================
# 工具函数
# ============================================================

def safe_int(value, default=0):
    """
    将 TSV 中的值安全转换为 int。
    空值、NaN、None 等直接返回 default。
    """
    if value is None:
        return default

    text = str(value).strip()

    if not text or text.lower() in {"nan", "null", "none"}:
        return default

    try:
        return int(text)
    except ValueError:
        try:
            return int(float(text))
        except (TypeError, ValueError):
            return default


def find_member(zip_file, filename):
    """
    在 ZIP 内寻找指定 TSV。
    兼容：
      persons.tsv
      某个目录/persons.tsv
      WCA_export_Persons.tsv
    """
    target = filename.lower()

    for member in zip_file.namelist():
        basename = member.rsplit("/", 1)[-1].lower()

        if basename == target:
            return member

    raise FileNotFoundError(
        f"在 WCA Export 中找不到文件: {filename}\n"
        f"当前 ZIP 内文件示例:\n"
        + "\n".join(zip_file.namelist()[:50])
    )


def read_tsv(zip_file, member_name):
    """
    从 ZIP 中直接流式读取 TSV，不需要先全部解压到磁盘。
    """
    raw = zip_file.open(member_name, "r")
    text = io.TextIOWrapper(
        raw,
        encoding="utf-8-sig",
        newline=""
    )

    try:
        reader = csv.DictReader(text, delimiter="\t")
        for row in reader:
            yield row
    finally:
        text.close()


def parse_competition_date(row):
    """
    v2 优先使用 start_date。
    同时兼容旧式 year/month/day 字段。
    """
    start_date = str(row.get("start_date") or "").strip()

    if start_date:
        return start_date[:10]

    year = safe_int(row.get("year"), 0)
    month = safe_int(row.get("month"), 0)
    day = safe_int(row.get("day"), 0)

    if year and month and day:
        try:
            return f"{year:04d}-{month:02d}-{day:02d}"
        except Exception:
            pass

    return ""


def atomic_write_json(filename, data):
    """
    先写临时文件，再替换正式文件，避免中途失败产生损坏 JSON。
    """
    temp_name = filename + ".tmp"

    with open(temp_name, "w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            separators=(",", ":")
        )

    os.replace(temp_name, filename)


def update_rank_entry(target, row):
    """
    保存 ranks_single / ranks_average 中的当前 PR 排名信息。
    """
    person_id = str(
        row.get("person_id")
        or row.get("personId")
        or ""
    ).strip()

    event_id = str(
        row.get("event_id")
        or row.get("eventId")
        or ""
    ).strip()

    if not person_id or not event_id:
        return

    if person_id not in NB_ID_SET:
        return

    target[(person_id, event_id)] = {
        "best": safe_int(row.get("best")),
        "world_rank": safe_int(
            row.get("world_rank") or row.get("worldRank")
        ),
        "continent_rank": safe_int(
            row.get("continent_rank") or row.get("continentRank")
        ),
        "country_rank": safe_int(
            row.get("country_rank") or row.get("countryRank")
        )
    }


def better_record(current_ref, new_value, new_date):
    """
    判断一条比赛成绩是否应该成为当前保存的 PR 对应比赛。
    成绩更快优先；成绩相同则保留较新的比赛。
    """
    if new_value <= 0:
        return False

    if current_ref is None:
        return True

    old_value = current_ref["value"]
    old_date = current_ref.get("date", "")

    if new_value < old_value:
        return True

    if new_value == old_value and new_date > old_date:
        return True

    return False


# ============================================================
# 主程序
# ============================================================

def update_wca_data():
    print("=" * 60)
    print("开始更新 WCA 数据")
    print("=" * 60)

    session = requests.Session()
    session.headers.update(HEADERS)

    # --------------------------------------------------------
    # 1. 获取最新 WCA Export 地址
    # --------------------------------------------------------

    print("\n[1/8] 获取最新 WCA Export 信息...")

    api_response = session.get(
        WCA_EXPORT_API,
        timeout=(30, 60)
    )
    api_response.raise_for_status()

    export_info = api_response.json()

    export_date = export_info.get("export_date")
    export_version = export_info.get("export_format_version")
    tsv_url = export_info.get("tsv_url")

    print(f"Export date   : {export_date}")
    print(f"Export version: {export_version}")
    print(f"TSV URL       : {tsv_url}")

    if not tsv_url:
        raise RuntimeError("WCA API 没有返回 tsv_url。")

    # WCA 当前 Results Export 是 2.x
    if export_version:
        major_version = str(export_version).split(".", 1)[0]
        if major_version != "2":
            raise RuntimeError(
                f"检测到不支持的 WCA Export 主版本: {export_version}"
            )

    # --------------------------------------------------------
    # 2. 下载 TSV ZIP
    # --------------------------------------------------------

    print("\n[2/8] 下载 WCA Export...")

    temp_dir = tempfile.mkdtemp(prefix="wca_update_")
    zip_path = os.path.join(temp_dir, "wca_export.tsv.zip")

    try:
        with session.get(
            tsv_url,
            stream=True,
            timeout=(30, 600)
        ) as response:
            response.raise_for_status()

            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            chunk_size = 8 * 1024 * 1024

            with open(zip_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    if not chunk:
                        continue

                    f.write(chunk)
                    downloaded += len(chunk)

                    if total_size:
                        percent = downloaded * 100 / total_size
                        print(
                            f"\r下载进度: {percent:6.2f}% "
                            f"({downloaded / 1024 / 1024:.1f} MB)",
                            end="",
                            flush=True
                        )
                    else:
                        print(
                            f"\r已下载: {downloaded / 1024 / 1024:.1f} MB",
                            end="",
                            flush=True
                        )

        print("\n下载完成。")

        # ----------------------------------------------------
        # 3. 打开 ZIP 并识别 v2 文件
        # ----------------------------------------------------

        print("\n[3/8] 检查 Export 文件结构...")

        with zipfile.ZipFile(zip_path, "r") as z:
            members = z.namelist()

            print(f"ZIP 内共有 {len(members)} 个文件。")

            metadata_member = find_member(z, "metadata.json")

            with z.open(metadata_member, "r") as f:
                metadata = json.loads(
                    f.read().decode("utf-8-sig")
                )

            actual_version = metadata.get("export_format_version")
            actual_export_date = metadata.get("export_date")

            print(f"metadata version: {actual_version}")
            print(f"metadata date   : {actual_export_date}")

            if actual_version:
                major_version = str(actual_version).split(".", 1)[0]
                if major_version != "2":
                    raise RuntimeError(
                        f"ZIP 内部 Export 主版本不是 2.x: {actual_version}"
                    )

            persons_member = find_member(z, "persons.tsv")
            countries_member = find_member(z, "countries.tsv")
            competitions_member = find_member(z, "competitions.tsv")
            results_member = find_member(z, "results.tsv")
            ranks_single_member = find_member(z, "ranks_single.tsv")
            ranks_average_member = find_member(z, "ranks_average.tsv")
            result_attempts_member = find_member(
                z,
                "result_attempts.tsv"
            )

            print("已找到：")
            print(f"  persons          : {persons_member}")
            print(f"  countries        : {countries_member}")
            print(f"  competitions     : {competitions_member}")
            print(f"  results          : {results_member}")
            print(f"  ranks_single     : {ranks_single_member}")
            print(f"  ranks_average    : {ranks_average_member}")
            print(f"  result_attempts  : {result_attempts_member}")

            # ------------------------------------------------
            # 4. 读取 countries
            # ------------------------------------------------

            print("\n[4/8] 读取选手与赛事基础信息...")

            countries = {}

            for row in read_tsv(z, countries_member):
                country_id = str(
                    row.get("id") or ""
                ).strip()

                iso2 = str(
                    row.get("iso2") or ""
                ).strip().upper()

                if country_id:
                    countries[country_id] = iso2

            print(f"国家数据: {len(countries)}")

            # ------------------------------------------------
            # 读取 persons
            # ------------------------------------------------

            persons = {}

            for row in read_tsv(z, persons_member):
                wca_id = str(
                    row.get("wca_id")
                    or row.get("id")
                    or ""
                ).strip().upper()

                if wca_id not in NB_ID_SET:
                    continue

                country_id = str(
                    row.get("country_id")
                    or row.get("countryId")
                    or ""
                ).strip()

                country_iso2 = countries.get(
                    country_id,
                    country_id.upper() if len(country_id) == 2 else ""
                )

                persons[wca_id] = {
                    "name": str(
                        row.get("name") or ""
                    ).strip(),

                    "wca_id": wca_id,

                    "country_iso2": country_iso2,

                    "gender": str(
                        row.get("gender") or ""
                    ).strip()
                }

            print(f"宁波选手实际存在于 WCA Export 中: {len(persons)}")

            missing_ids = sorted(NB_ID_SET - set(persons.keys()))

            if missing_ids:
                print(
                    f"警告：以下 {len(missing_ids)} 个 WCA ID "
                    f"没有出现在 Export 中："
                )
                print(", ".join(missing_ids))

            # ------------------------------------------------
            # competitions
            # ------------------------------------------------

            competitions = {}

            for row in read_tsv(z, competitions_member):
                comp_id = str(
                    row.get("id") or ""
                ).strip()

                if not comp_id:
                    continue

                competitions[comp_id] = {
                    "name": str(
                        row.get("name") or "-"
                    ).strip() or "-",

                    "date": parse_competition_date(row)
                }

            print(f"比赛数据: {len(competitions)}")

            # ------------------------------------------------
            # 读取当前 PR 排名
            # ------------------------------------------------

            ranks_single = {}
            ranks_average = {}

            for row in read_tsv(z, ranks_single_member):
                update_rank_entry(ranks_single, row)

            for row in read_tsv(z, ranks_average_member):
                update_rank_entry(ranks_average, row)

            print(f"单次 PR 数据: {len(ranks_single)}")
            print(f"平均 PR 数据: {len(ranks_average)}")

            # ------------------------------------------------
            # 5. 读取 Results
            # ------------------------------------------------

            print("\n[5/8] 读取宁波选手历史比赛成绩...")

            history_data = {}

            # result_id -> 对应 history record
            result_record_map = {}

            # PR 对应的比赛
            best_single_refs = {}
            best_average_refs = {}

            # 选手基础统计
            competition_sets = {
                wca_id: set()
                for wca_id in persons.keys()
            }

            medals = {
                wca_id: {
                    "gold": 0,
                    "silver": 0,
                    "bronze": 0
                }
                for wca_id in persons.keys()
            }

            for row in read_tsv(z, results_member):

                person_id = str(
                    row.get("person_id")
                    or row.get("personId")
                    or ""
                ).strip().upper()

                if person_id not in NB_ID_SET:
                    continue

                # 有些 ID 虽在名单中，但当前 Export Persons 没有
                if person_id not in persons:
                    continue

                event_id = str(
                    row.get("event_id")
                    or row.get("eventId")
                    or ""
                ).strip()

                competition_id = str(
                    row.get("competition_id")
                    or row.get("competitionId")
                    or ""
                ).strip()

                round_type_id = str(
                    row.get("round_type_id")
                    or row.get("roundTypeId")
                    or ""
                ).strip()

                pos = safe_int(row.get("pos"))

                best = safe_int(row.get("best"))
                average = safe_int(row.get("average"))

                comp_info = competitions.get(
                    competition_id,
                    {}
                )

                comp_name = comp_info.get("name", "-")
                comp_date = comp_info.get("date", "")

                record = {
                    "date": comp_date,
                    "comp": competition_id,
                    "round": round_type_id,
                    "pos": pos,
                    "single": best,
                    "average": average,
                    "v1": 0,
                    "v2": 0,
                    "v3": 0,
                    "v4": 0,
                    "v5": 0
                }

                history_data.setdefault(
                    person_id,
                    {}
                ).setdefault(
                    event_id,
                    []
                ).append(record)

                # 用 result.id 对接 result_attempts
                result_id = str(
                    row.get("id") or ""
                ).strip()

                if result_id:
                    result_record_map[result_id] = record

                # 参赛次数
                if competition_id:
                    competition_sets[person_id].add(
                        competition_id
                    )

                # 奖牌
                if round_type_id in {"c", "f"}:
                    if pos == 1:
                        medals[person_id]["gold"] += 1
                    elif pos == 2:
                        medals[person_id]["silver"] += 1
                    elif pos == 3:
                        medals[person_id]["bronze"] += 1

                # PR 对应比赛
                if best > 0:
                    key = (person_id, event_id)

                    current = best_single_refs.get(key)

                    if better_record(
                        current,
                        best,
                        comp_date
                    ):
                        best_single_refs[key] = {
                            "value": best,
                            "date": comp_date,
                            "comp_name": comp_name,
                            "comp_date": comp_date
                        }

                if average > 0:
                    key = (person_id, event_id)

                    current = best_average_refs.get(key)

                    if better_record(
                        current,
                        average,
                        comp_date
                    ):
                        best_average_refs[key] = {
                            "value": average,
                            "date": comp_date,
                            "comp_name": comp_name,
                            "comp_date": comp_date
                        }

            # ------------------------------------------------
            # 6. 读取 result_attempts
            # ------------------------------------------------

            print("\n[6/8] 读取单次尝试数据...")

            attempt_count = 0

            for row in read_tsv(z, result_attempts_member):

                result_id = str(
                    row.get("result_id")
                    or ""
                ).strip()

                if result_id not in result_record_map:
                    continue

                attempt_number = safe_int(
                    row.get("attempt_number")
                )

                if attempt_number < 1 or attempt_number > 5:
                    continue

                value = safe_int(
                    row.get("value")
                )

                record = result_record_map[result_id]

                record[f"v{attempt_number}"] = value

                attempt_count += 1

            print(
                f"匹配到宁波选手的单次尝试数据: "
                f"{attempt_count}"
            )

            # ------------------------------------------------
            # 整理历史数据
            # ------------------------------------------------

            for wca_id in history_data:

                for event_id in history_data[wca_id]:

                    history_data[wca_id][event_id].sort(
                        key=lambda x: (
                            x.get("date", ""),
                            x.get("comp", "")
                        )
                    )

            # ------------------------------------------------
            # 7. 生成 wca_data.json
            # ------------------------------------------------

            print("\n[7/8] 生成 wca_data.json...")

            all_cubers_data = []

            for wca_id in NB_IDS:

                if wca_id not in persons:
                    continue

                person = persons[wca_id]

                cuber_obj = {
                    "person": person,
                    "competition_count": len(
                        competition_sets.get(wca_id, set())
                    ),
                    "competition_ids": sorted(
                        competition_sets.get(wca_id, set())
                    ),
                    "personal_records": {},
                    "medals": {
                        "gold": medals[wca_id]["gold"],
                        "silver": medals[wca_id]["silver"],
                        "bronze": medals[wca_id]["bronze"],
                        "total": (
                            medals[wca_id]["gold"]
                            + medals[wca_id]["silver"]
                            + medals[wca_id]["bronze"]
                        )
                    },
                    "records": {
                        "national": 0,
                        "continental": 0,
                        "world": 0,
                        "total": 0
                    },
                    "total_solves": 0
                }

                # --------------------------------------------
                # personal records
                # --------------------------------------------

                all_events = set()

                all_events.update(
                    event_id
                    for pid, event_id in ranks_single.keys()
                    if pid == wca_id
                )

                all_events.update(
                    event_id
                    for pid, event_id in ranks_average.keys()
                    if pid == wca_id
                )

                all_events.update(
                    event_id
                    for pid, event_id in best_single_refs.keys()
                    if pid == wca_id
                )

                all_events.update(
                    event_id
                    for pid, event_id in best_average_refs.keys()
                    if pid == wca_id
                )

                for event_id in sorted(all_events):

                    event_obj = {}

                    # ----------------------------------------
                    # 单次
                    # ----------------------------------------

                    single_rank = ranks_single.get(
                        (wca_id, event_id)
                    )

                    single_ref = best_single_refs.get(
                        (wca_id, event_id)
                    )

                    if single_rank or single_ref:

                        if single_rank:
                            best_value = single_rank["best"]
                            world_rank = single_rank["world_rank"]
                            continent_rank = single_rank["continent_rank"]
                            country_rank = single_rank["country_rank"]
                        else:
                            best_value = single_ref["value"]
                            world_rank = 0
                            continent_rank = 0
                            country_rank = 0

                        event_obj["single"] = {
                            "best": best_value,
                            "world_rank": world_rank,
                            "continent_rank": continent_rank,
                            "country_rank": country_rank,
                            "comp_name": (
                                single_ref["comp_name"]
                                if single_ref
                                else "-"
                            ),
                            "comp_date": (
                                single_ref["comp_date"]
                                if single_ref
                                else "-"
                            )
                        }

                        # 当前排名为第一名时，视作当前记录持有状态
                        if world_rank == 1:
                            cuber_obj["records"]["world"] += 1

                        if continent_rank == 1:
                            cuber_obj["records"]["continental"] += 1

                        if country_rank == 1:
                            cuber_obj["records"]["national"] += 1

                    # ----------------------------------------
                    # 平均
                    # ----------------------------------------

                    average_rank = ranks_average.get(
                        (wca_id, event_id)
                    )

                    average_ref = best_average_refs.get(
                        (wca_id, event_id)
                    )

                    if average_rank or average_ref:

                        if average_rank:
                            best_value = average_rank["best"]
                            world_rank = average_rank["world_rank"]
                            continent_rank = average_rank["continent_rank"]
                            country_rank = average_rank["country_rank"]
                        else:
                            best_value = average_ref["value"]
                            world_rank = 0
                            continent_rank = 0
                            country_rank = 0

                        event_obj["average"] = {
                            "best": best_value,
                            "world_rank": world_rank,
                            "continent_rank": continent_rank,
                            "country_rank": country_rank,
                            "comp_name": (
                                average_ref["comp_name"]
                                if average_ref
                                else "-"
                            ),
                            "comp_date": (
                                average_ref["comp_date"]
                                if average_ref
                                else "-"
                            )
                        }

                        if world_rank == 1:
                            cuber_obj["records"]["world"] += 1

                        if continent_rank == 1:
                            cuber_obj["records"]["continental"] += 1

                        if country_rank == 1:
                            cuber_obj["records"]["national"] += 1

                    if event_obj:
                        cuber_obj["personal_records"][
                            event_id
                        ] = event_obj

                cuber_obj["records"]["total"] = (
                    cuber_obj["records"]["national"]
                    + cuber_obj["records"]["continental"]
                    + cuber_obj["records"]["world"]
                )

                # 统计总有效单次成绩数量
                person_history = history_data.get(
                    wca_id,
                    {}
                )

                total_solves = 0

                for event_records in person_history.values():
                    for record in event_records:
                        for i in range(1, 6):
                            if safe_int(record.get(f"v{i}")) > 0:
                                total_solves += 1

                cuber_obj["total_solves"] = total_solves

                all_cubers_data.append(cuber_obj)

            # ------------------------------------------------
            # 8. 输出两个 JSON
            # ------------------------------------------------

            print("\n[8/8] 写入 JSON 文件...")

            atomic_write_json(
                OUTPUT_WCA,
                all_cubers_data
            )

            atomic_write_json(
                OUTPUT_HISTORY,
                history_data
            )

            print("\n" + "=" * 60)
            print("WCA 数据更新完成！")
            print("=" * 60)
            print(
                f"选手数量       : {len(all_cubers_data)}"
            )
            print(
                f"wca_data.json   : {os.path.getsize(OUTPUT_WCA) / 1024:.1f} KB"
            )
            print(
                f"history_data.json: "
                f"{os.path.getsize(OUTPUT_HISTORY) / 1024:.1f} KB"
            )
            print(
                f"Export date     : "
                f"{actual_export_date or export_date}"
            )

    finally:
        # 删除临时 ZIP
        if os.path.exists(temp_dir):
            shutil.rmtree(
                temp_dir,
                ignore_errors=True
            )


if __name__ == "__main__":
    update_wca_data()
    
