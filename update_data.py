import urllib.request
import json
import time
import os

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
with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(all_cubers_data, f, ensure_ascii=False)
    
print(f"数据更新完毕，共包含 {len(all_cubers_data)} 位选手，已保存至 {file_path}")
