import urllib.request
import json
import time
import os
import urllib.request
import zipfile

# 这是你提供的所有宁波选手 ID
roster_ids = [
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

all_cubers_data = []

# 自动下载 WCA 官方最新数据库导出压缩包
url = "https://www.worldcubeassociation.org/results/misc/WCA_export.tsv.zip"
zip_path = "WCA_export.tsv.zip"
extract_dir = "WCA_export"

print("正在从 WCA 官网下载最新数据库导出压缩包...")
urllib.request.urlretrieve(url, zip_path)

print("正在解压数据库文件...")
os.makedirs(extract_dir, exist_ok=True)
with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_dir)
print("解压完成，准备开始解析...")

print("开始拉取 WCA 数据...")
for wca_id in roster_ids:
    url = f"https://www.worldcubeassociation.org/api/v0/persons/{wca_id}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    # 尝试拉取数据，加入重试机制
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                all_cubers_data.append(data)
                print(f"成功获取: {wca_id}")
                break
        except Exception as e:
            print(f"获取 {wca_id} 失败 (尝试 {attempt+1}/3): {e}")
            time.sleep(2)
    
    # 每次请求后休眠 1 秒，由于是夜间服务器后台运行，慢一点也没关系，确保不被官方封禁
    time.sleep(1)

# 将拉取到的数据保存为本地 JSON 文件
file_path = 'wca_data.json'

import csv

print("开始解析本地 TSV 压缩包匹配比赛信息...")

# 1. 提取全量比赛字典 (id -> name, date)
comp_dict = {}
with open('WCA_export/WCA_export_competitions.tsv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        comp_dict[row['id']] = {
            'name': row['name'],
            'date': f"{row['year']}-{row['month'].zfill(2)}-{row['day'].zfill(2)}"
        }

# 2. 从数千万条流水中，过滤出宁波选手的成绩
pr_map = {}
history_map = {}
roster_set = set(roster_ids)

# 【核心新增】：主键映射字典。用于把 result_id 和它对应的单场成绩记录本关联起来
result_id_to_record = {}

with open('WCA_export/WCA_export_results.tsv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    for row in reader:
        wca_id = row.get('person_id') or row.get('personId')

        if wca_id in roster_set:
            ev = row.get('event_id') or row.get('eventId')
            comp_id = row.get('competition_id') or row.get('competitionId')
            res_id = row.get('id')  # 拿到这条成绩的唯一主键 ID

            # --- 记录 PR 成绩用于匹配比赛名称 ---
            if wca_id not in pr_map: pr_map[wca_id] = {}
            if ev not in pr_map[wca_id]: pr_map[wca_id][ev] = {'single': {}, 'average': {}}

            single_val = row.get('best')
            if single_val and single_val != '-1':
                pr_map[wca_id][ev]['single'][str(single_val)] = comp_id

            avg_val = row.get('average')
            if avg_val and avg_val != '-1':
                pr_map[wca_id][ev]['average'][str(avg_val)] = comp_id

            # --- 记录参赛成绩流水（主表信息） ---
            if wca_id not in history_map: history_map[wca_id] = {}
            if ev not in history_map[wca_id]: history_map[wca_id][ev] = []

            comp_date = comp_dict.get(comp_id, {}).get('date', '1970-01-01')
            comp_name = comp_dict.get(comp_id, {}).get('name', comp_id)

            if (single_val and single_val != '-1') or (avg_val and avg_val != '-1'):
                record = {
                    'date': comp_date,
                    'comp': comp_name,
                    'round': row.get('roundTypeId') or row.get('round_type_id') or '',
                    'pos': row.get('pos') or row.get('position') or '',
                    'single': int(single_val) if single_val != '-1' else None,
                    'average': int(avg_val) if avg_val != '-1' else None,
                    'v1': 0, 'v2': 0, 'v3': 0, 'v4': 0, 'v5': 0  # 详情暂设为0，等下一张明细表来填！
                }
                history_map[wca_id][ev].append(record)

                # 核心逻辑：存下主键引用，让后面的 attempts 表能精准找到这条记录注入详情！
                if res_id:
                    result_id_to_record[res_id] = record

# =====================================================================
# 2.5 终极破解：跨表读取 result_attempts 详情明细表，填充五次复原成绩！
# =====================================================================
print("开始解析成绩详情表 (result_attempts.tsv)，填入5次复原数据...")
try:
    with open('WCA_export/WCA_export_result_attempts.tsv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            res_id = row.get('result_id') or row.get('resultId')

            # 只要这个成绩明细属于我们刚存过的宁波选手记录，就抓取它的尝试次数和数值！
            if res_id and res_id in result_id_to_record:
                attempt_num = str(row.get('attempt_number') or row.get('attemptNumber') or row.get('attempt')).strip()
                value = row.get('value') or row.get('time') or row.get('result')

                if attempt_num and value:
                    try:
                        val_int = int(value)
                        # 根据尝试的次数 (1~5)，精准填入刚才初始化的 v1~v5 中
                        if attempt_num == '1':
                            result_id_to_record[res_id]['v1'] = val_int
                        elif attempt_num == '2':
                            result_id_to_record[res_id]['v2'] = val_int
                        elif attempt_num == '3':
                            result_id_to_record[res_id]['v3'] = val_int
                        elif attempt_num == '4':
                            result_id_to_record[res_id]['v4'] = val_int
                        elif attempt_num == '5':
                            result_id_to_record[res_id]['v5'] = val_int
                    except:
                        pass
except Exception as e:
    print(f"读取 result_attempts 发生错误: {e}")

print("开始按时间排序并生成 history_data.json...")
# 对每个选手的每个项目的成绩按时间顺序排序
for w_id, ev_data in history_map.items():
    for ev_id, records_list in ev_data.items():
        records_list.sort(key=lambda x: x['date'])

# 将历史数据单独存为一个 JSON 文件，避免主文件太大影响首屏加载速度
import json

with open('history_data.json', 'w', encoding='utf-8') as f:
    json.dump(history_map, f, ensure_ascii=False)

# 3. 将比赛信息注入到 API 拿到的最好成绩(PR)节点中
for cuber in all_cubers_data:
    wca_id = cuber['person']['wca_id']
    records = cuber.get('personal_records', {})
    for ev_id, types in records.items():
        for t_id, record in types.items():
            best_val = str(record['best'])
            # 根据最好成绩的值，反查出是在哪场比赛取得的
            comp_id = pr_map.get(wca_id, {}).get(ev_id, {}).get(t_id, {}).get(best_val)
            if comp_id:
                info = comp_dict.get(comp_id, {})
                record['comp_name'] = info.get('name', comp_id)
                record['comp_date'] = info.get('date', '')

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(all_cubers_data, f, ensure_ascii=False)
    
print(f"数据更新完毕，共包含 {len(all_cubers_data)} 位选手，已保存至 {file_path}")
