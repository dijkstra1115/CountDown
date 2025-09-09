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
    try:
        # 先寫入臨時文件，然後重命名，確保原子性
        temp_file = DATA_FILE + '.tmp'
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # 原子性重命名
        import os
        if os.name == 'nt':  # Windows
            if os.path.exists(DATA_FILE):
                os.remove(DATA_FILE)
            os.rename(temp_file, DATA_FILE)
        else:  # Unix/Linux
            os.rename(temp_file, DATA_FILE)
            
        print(f"數據成功寫入到 {DATA_FILE}")
        
    except Exception as e:
        print(f"寫入數據失敗: {str(e)}")
        # 清理臨時文件
        try:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        except:
            pass
        raise e

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
        print(f"收到補簽到請求: 日期={request.date}, 密碼={request.password[:3]}***")
        
        # 驗證密碼
        if request.password != RETROACTIVE_PASSWORD:
            print("密碼驗證失敗")
            raise HTTPException(status_code=401, detail="密碼錯誤，無權限進行補簽到")
        
        data = read_data()
        print(f"當前數據: {data}")
        
        # 檢查是否已經簽到
        if request.date in data:
            print(f"第{request.date}天已經簽到過了")
            raise HTTPException(status_code=400, detail=f"第{request.date}天已經簽到過了！")
        
        # 驗證日期範圍（1-21天）
        day_number = int(request.date)
        if day_number < 1 or day_number > 21:
            print(f"日期範圍錯誤: {day_number}")
            raise HTTPException(status_code=400, detail="日期範圍錯誤，只能補簽第1-21天")
        
        # 添加補簽到記錄
        new_record = {
            "timestamp": request.timestamp,
            "date": request.date,
            "created_at": datetime.now().isoformat(),
            "is_retroactive": True  # 標記為補簽到
        }
        data[request.date] = new_record
        print(f"添加補簽到記錄: {new_record}")
        
        # 保存數據
        try:
            write_data(data)
            print("數據保存成功")
            
            # 驗證保存是否成功
            saved_data = read_data()
            if request.date not in saved_data:
                print("警告: 數據保存後驗證失敗")
                raise HTTPException(status_code=500, detail="數據保存失敗，請重試")
            
            print(f"補簽到成功: 第{request.date}天")
            return {"success": True, "data": data, "message": f"第{request.date}天補簽到成功！"}
            
        except Exception as write_error:
            print(f"數據保存失敗: {str(write_error)}")
            raise HTTPException(status_code=500, detail=f"數據保存失敗: {str(write_error)}")
            
    except HTTPException:
        raise
    except ValueError:
        print("日期格式錯誤")
        raise HTTPException(status_code=400, detail="日期格式錯誤")
    except Exception as e:
        print(f"補簽到異常: {str(e)}")
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

# 調試端點 - 檢查文件系統狀態
@app.get("/debug/filesystem")
async def debug_filesystem():
    """調試端點 - 檢查文件系統狀態"""
    import os
    import stat
    
    try:
        # 檢查當前工作目錄
        cwd = os.getcwd()
        
        # 檢查數據文件是否存在
        data_file_exists = os.path.exists(DATA_FILE)
        
        # 檢查文件權限
        file_permissions = None
        if data_file_exists:
            file_stat = os.stat(DATA_FILE)
            file_permissions = oct(file_stat.st_mode)[-3:]
        
        # 檢查目錄權限
        dir_permissions = oct(os.stat('.').st_mode)[-3:]
        
        # 嘗試創建測試文件
        test_file = "test_write.tmp"
        can_write = False
        try:
            with open(test_file, 'w') as f:
                f.write("test")
            can_write = True
            os.remove(test_file)
        except Exception as e:
            write_error = str(e)
        
        return {
            "current_directory": cwd,
            "data_file_exists": data_file_exists,
            "data_file_permissions": file_permissions,
            "directory_permissions": dir_permissions,
            "can_write_files": can_write,
            "write_error": write_error if not can_write else None,
            "data_file_path": os.path.abspath(DATA_FILE)
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",  # 使用字符串路徑來支持reload
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
