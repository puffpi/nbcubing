import pandas as pd
import requests, zipfile, io, json

def update_wca_data():
    print("Fetching WCA Export URL...")
    # 增加 User-Agent 请求头伪装，绕过 Cloudflare 防爬虫拦截
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    # 通过 WCA 官方 API 动态获取当天最新的数据包下载地址
    api_url = "https://www.worldcubeassociation.org/api/v0/export/public"
    api_res = requests.get(api_url, headers=headers)
    
    if api_res.status_code != 200:
        print(f"获取下载链接失败，状态码: {api_res.status_code}")
        return
        
    tsv_url = api_res.json().get("tsv_url")
    print(f"Downloading WCA Export from: {tsv_url} ...")
    
    r = requests.get(tsv_url, headers=headers)
    if r.status_code != 200:
        print(f"下载压缩包失败，状态码: {r.status_code}")
        return
        
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        z.extractall("wca_export")

    print("Loading datasets...")
    df_persons = pd.read_csv("wca_export/WCA_export_Persons.tsv", sep='\t', low_memory=False)
    df_results = pd.read_csv("wca_export/WCA_export_Results.tsv", sep='\t', low_memory=False)
    df_ranks_single = pd.read_csv("wca_export/WCA_export_RanksSingle.tsv", sep='\t', low_memory=False)
    df_ranks_avg = pd.read_csv("wca_export/WCA_export_RanksAverage.tsv", sep='\t', low_memory=False)
    df_comps = pd.read_csv("wca_export/WCA_export_Competitions.tsv", sep='\t', low_memory=False)

    nb_ids = [
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

    print("Processing WCA Data...")
    nb_persons = df_persons[df_persons['id'].isin(nb_ids)].copy()
    
    all_cubers_data = []
    for _, person in nb_persons.iterrows():
        wca_id = person['id']
        cuber_obj = {
            "person": {
                "name": person['name'],
                "wca_id": wca_id,
                "country_iso2": person['countryId'],
                "gender": person['gender']
            },
            "personal_records": {}
        }
        
        p_single = df_ranks_single[df_ranks_single['personId'] == wca_id]
        p_avg = df_ranks_avg[df_ranks_avg['personId'] == wca_id]
        
        events = set(p_single['eventId'].tolist() + p_avg['eventId'].tolist())
        for ev in events:
            cuber_obj["personal_records"][ev] = {}
            s_rec = p_single[p_single['eventId'] == ev]
            if not s_rec.empty:
                cuber_obj["personal_records"][ev]["single"] = {
                    "best": int(s_rec.iloc[0]['best']),
                    "world_rank": int(s_rec.iloc[0]['worldRank']),
                    "continent_rank": int(s_rec.iloc[0]['continentRank']),
                    "country_rank": int(s_rec.iloc[0]['countryRank'])
                }
            
            a_rec = p_avg[p_avg['eventId'] == ev]
            if not a_rec.empty:
                cuber_obj["personal_records"][ev]["average"] = {
                    "best": int(a_rec.iloc[0]['best']),
                    "world_rank": int(a_rec.iloc[0]['worldRank']),
                    "continent_rank": int(a_rec.iloc[0]['continentRank']),
                    "country_rank": int(a_rec.iloc[0]['countryRank'])
                }
        all_cubers_data.append(cuber_obj)

    with open("wca_data.json", "w", encoding="utf-8") as f:
        json.dump(all_cubers_data, f, ensure_ascii=False)

    print("Processing History Data...")
    history_data = {}
    nb_results = df_results[df_results['personId'].isin(nb_ids)]
    
    for wca_id, group in nb_results.groupby('personId'):
        history_data[wca_id] = {}
        for ev, ev_group in group.groupby('eventId'):
            records = []
            for _, row in ev_group.iterrows():
                comp_info = df_comps[df_comps['id'] == row['competitionId']]
                date_str = ""
                if not comp_info.empty:
                    date_str = f"{comp_info.iloc[0]['year']}-{str(comp_info.iloc[0]['month']).zfill(2)}-{str(comp_info.iloc[0]['day']).zfill(2)}"

                records.append({
                    "date": date_str,
                    "comp": row['competitionId'],
                    "round": row['roundTypeId'],
                    "pos": int(row['pos']),
                    "single": int(row['best']),
                    "average": int(row['average']),
                    "v1": int(row['value1']),
                    "v2": int(row['value2']),
                    "v3": int(row['value3']),
                    "v4": int(row['value4']),
                    "v5": int(row['value5'])
                })
            records.sort(key=lambda x: x['date'])
            history_data[wca_id][ev] = records

    with open("history_data.json", "w", encoding="utf-8") as f:
        json.dump(history_data, f, ensure_ascii=False)
        
    print("Update Complete.")

if __name__ == "__main__":
    update_wca_data()
    
