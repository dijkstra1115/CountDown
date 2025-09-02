from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import json
import os
from datetime import datetime
from typing import Dict, Any

app = FastAPI(title="三週簽到挑戰", description="一個美觀的簽到挑戰網頁")

# 數據文件路徑
DATA_FILE = "checkin_data.json"

# 補簽到密碼（您可以修改這個密碼）
RETROACTIVE_PASSWORD = "ruru7749"

# 數據模型
class CheckinRequest(BaseModel):
    date: str
    timestamp: int

class CheckinUpdate(BaseModel):
    data: Dict[str, Any]

class RetroactiveCheckinRequest(BaseModel):
    date: str
    password: str
    timestamp: int

# 確保數據文件存在
def ensure_data_file():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)

# 讀取數據
def read_data() -> Dict[str, Any]:
    ensure_data_file()
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {}

# 寫入數據
def write_data(data: Dict[str, Any]):
    ensure_data_file()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 掛載靜態文件
app.mount("/static", StaticFiles(directory="."), name="static")

# 根路徑返回主頁
@app.get("/")
async def read_root():
    return FileResponse("index.html")

# 獲取簽到數據
@app.get("/api/checkin")
async def get_checkin_data():
    """獲取所有簽到數據"""
    try:
        data = read_data()
        return {"success": True, "data": data, "message": "數據獲取成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"獲取數據失敗: {str(e)}")

# 新增簽到記錄
@app.post("/api/checkin")
async def add_checkin(checkin: CheckinRequest):
    """新增簽到記錄"""
    try:
        data = read_data()
        
        # 檢查是否已經簽到
        if checkin.date in data:
            raise HTTPException(status_code=400, detail="今天已經簽到過了！")
        
        # 添加簽到記錄
        data[checkin.date] = {
            "timestamp": checkin.timestamp,
            "date": checkin.date,
            "created_at": datetime.now().isoformat()
        }
        
        # 保存數據
        write_data(data)
        
        return {"success": True, "data": data, "message": "簽到成功！"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"簽到失敗: {str(e)}")

# 更新簽到數據
@app.put("/api/checkin")
async def update_checkin_data(update: CheckinUpdate):
    """更新簽到數據（用於同步）"""
    try:
        write_data(update.data)
        return {"success": True, "message": "數據更新成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新數據失敗: {str(e)}")

# 重置簽到數據
@app.delete("/api/checkin")
async def reset_checkin_data():
    """重置所有簽到數據"""
    try:
        write_data({})
        return {"success": True, "message": "數據重置成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重置數據失敗: {str(e)}")

# 補簽到功能
@app.post("/api/checkin/retroactive")
async def retroactive_checkin(request: RetroactiveCheckinRequest):
    """補簽到功能（需要密碼驗證）"""
    try:
        # 驗證密碼
        if request.password != RETROACTIVE_PASSWORD:
            raise HTTPException(status_code=401, detail="密碼錯誤，無權限進行補簽到")
        
        data = read_data()
        
        # 檢查是否已經簽到
        if request.date in data:
            raise HTTPException(status_code=400, detail=f"第{request.date}天已經簽到過了！")
        
        # 驗證日期範圍（1-21天）
        day_number = int(request.date)
        if day_number < 1 or day_number > 21:
            raise HTTPException(status_code=400, detail="日期範圍錯誤，只能補簽第1-21天")
        
        # 添加補簽到記錄
        data[request.date] = {
            "timestamp": request.timestamp,
            "date": request.date,
            "created_at": datetime.now().isoformat(),
            "is_retroactive": True  # 標記為補簽到
        }
        
        # 保存數據
        write_data(data)
        
        return {"success": True, "data": data, "message": f"第{request.date}天補簽到成功！"}
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式錯誤")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"補簽到失敗: {str(e)}")

# 獲取簽到統計
@app.get("/api/checkin/stats")
async def get_checkin_stats():
    """獲取簽到統計信息"""
    try:
        data = read_data()
        total_days = 21
        checked_days = len(data)
        remaining_days = max(0, total_days - checked_days)
        
        # 計算週進度
        week1_progress = min(max(checked_days, 0), 7) / 7 * 100
        week2_progress = min(max(checked_days - 7, 0), 7) / 7 * 100
        week3_progress = min(max(checked_days - 14, 0), 7) / 7 * 100
        
        return {
            "success": True,
            "stats": {
                "total_days": total_days,
                "checked_days": checked_days,
                "remaining_days": remaining_days,
                "progress_percentage": (checked_days / total_days) * 100,
                "week_progress": {
                    "week1": week1_progress,
                    "week2": week2_progress,
                    "week3": week3_progress
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"獲取統計失敗: {str(e)}")

# 健康檢查
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",  # 使用字符串路徑來支持reload
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
