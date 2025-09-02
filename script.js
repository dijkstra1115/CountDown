// 全局變數
const startDate = new Date('2025-08-27T00:00:00');
const totalDays = 21; // 三週 = 21天
let checkinData = {};
let currentProgress = 0;

// DOM 元素
const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const checkinSection = document.getElementById('checkinSection');
const checkinBtn = document.getElementById('checkinBtn');
const retroactiveBtn = document.getElementById('retroactiveBtn');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const progressNumber = document.getElementById('progressNumber');
const progressRing = document.getElementById('progressRing');
const week1Fill = document.getElementById('week1Fill');
const week2Fill = document.getElementById('week2Fill');
const week3Fill = document.getElementById('week3Fill');
const calendarGrid = document.getElementById('calendarGrid');
const completionOverlay = document.getElementById('completionOverlay');

// 補簽到相關元素
const retroactiveModal = document.getElementById('retroactiveModal');
const modalClose = document.getElementById('modalClose');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const retroactiveDay = document.getElementById('retroactiveDay');
const retroactivePassword = document.getElementById('retroactivePassword');

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 先初始化应用，等待数据加载完成
    await initializeApp();
    
    // 数据加载完成后再执行其他初始化
    startCountdown();
    generateCalendar();
    updateProgress();
    setInterval(startCountdown, 1000);
});

// 初始化應用
async function initializeApp() {
    try {
        // 從API加載簽到數據
        const response = await fetch('/api/checkin');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                checkinData = result.data;
                console.log('成功加載簽到數據:', checkinData);
            } else {
                console.log('API返回數據格式異常:', result);
                checkinData = {};
            }
        } else {
            console.error('API請求失敗:', response.status);
            checkinData = {};
        }
    } catch (error) {
        console.error('加載數據失敗:', error);
        checkinData = {};
    }
    
    // 始終顯示簽到區域
    checkinSection.style.display = 'block';
    updateCheckinStatus();
    
    // 綁定簽到按鈕事件
    checkinBtn.addEventListener('click', handleCheckin);
    
    // 綁定補簽到按鈕事件
    retroactiveBtn.addEventListener('click', showRetroactiveModal);
    
    // 綁定模态框事件
    modalClose.addEventListener('click', hideRetroactiveModal);
    modalCancel.addEventListener('click', hideRetroactiveModal);
    modalConfirm.addEventListener('click', handleRetroactiveCheckin);
    
    // 點擊模态框背景關閉
    retroactiveModal.addEventListener('click', (e) => {
        if (e.target === retroactiveModal) {
            hideRetroactiveModal();
        }
    });
    
    // 初始化補簽到選項
    initializeRetroactiveOptions();
}

// 倒數計時功能
function startCountdown() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 計算今天凌晨4:00的時間
    const today4AM = new Date(today);
    today4AM.setHours(4, 0, 0, 0);
    
    // 如果現在還沒到4:00，則倒計時到今天的4:00
    // 如果已經過了4:00，則倒計時到明天的4:00
    let targetTime;
    if (now < today4AM) {
        targetTime = today4AM;
    } else {
        targetTime = new Date(today4AM);
        targetTime.setDate(targetTime.getDate() + 1);
    }
    
    // 計算距離目標時間的時間
    const timeLeft = targetTime - now;
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    // 更新時間顯示，並添加變化動畫
    updateTimeDisplay(daysEl, days, 'days');
    updateTimeDisplay(hoursEl, hours, 'hours');
    updateTimeDisplay(minutesEl, minutes, 'minutes');
    updateTimeDisplay(secondsEl, seconds, 'seconds');
}

// 更新時間顯示並添加動畫效果
function updateTimeDisplay(element, newValue, type) {
    const oldValue = parseInt(element.textContent) || 0;
    const newValueStr = newValue.toString().padStart(2, '0');
    
    if (oldValue !== newValue) {
        // 添加變化動畫
        element.classList.add('changing');
        
        // 更新數值
        element.textContent = newValueStr;
        
        // 移除動畫類
        setTimeout(() => {
            element.classList.remove('changing');
        }, 300);
    }
}

// 處理簽到
async function handleCheckin() {
    const now = new Date();
    const startDate = new Date('2025-08-27T04:00:00'); // 從4:00開始計算
    
    // 計算從開始日期到現在的天數（以4:00為界）
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const todayDayNumber = (daysSinceStart + 1).toString();
    
    if (checkinData[todayDayNumber]) {
        showNotification('今天已經簽到過了！', 'info');
        return;
    }
    
    try {
        // 調用API進行簽到
        const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: todayDayNumber,
                timestamp: new Date().getTime()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            checkinData = result.data;
            
            // 更新UI
            updateCheckinStatus();
            updateProgress();
            updateCalendar();
            
            // 簽到成功動畫
            animateCheckinSuccess();
            
            // 檢查是否完成挑戰
            if (Object.keys(checkinData).length >= totalDays) {
                setTimeout(showCompletionEffect, 1000);
            }
        } else {
            showNotification('簽到失敗，請重試', 'warning');
        }
    } catch (error) {
        console.error('簽到錯誤:', error);
        showNotification('簽到失敗，請檢查網絡連接', 'warning');
    }
}

// 更新簽到狀態
function updateCheckinStatus() {
    const now = new Date();
    const startDate = new Date('2025-08-27T04:00:00'); // 從4:00開始計算
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const todayDayNumber = (daysSinceStart + 1).toString();
    const hasCheckedIn = checkinData[todayDayNumber];
    
    if (hasCheckedIn) {
        statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        statusIcon.style.color = '#48bb78';
        statusText.textContent = '今日已簽到！繼續加油！';
        checkinBtn.classList.add('completed');
        checkinBtn.innerHTML = '<span class="btn-text">已完成</span><i class="fas fa-check"></i>';
    } else {
        statusIcon.innerHTML = '<i class="fas fa-calendar-check"></i>';
        statusIcon.style.color = '#48bb78';
        statusText.textContent = '準備開始您的挑戰之旅！';
        checkinBtn.classList.remove('completed');
        checkinBtn.innerHTML = '<span class="btn-text">立即簽到</span><i class="fas fa-check"></i>';
    }
}

// 更新進度
function updateProgress() {
    const checkedDays = Object.keys(checkinData).length;
    currentProgress = Math.min(checkedDays, totalDays);
    
    // 更新進度數字
    progressNumber.textContent = currentProgress;
    
    // 更新圓環進度
    const circumference = 2 * Math.PI * 54; // 圓環周長
    const progress = currentProgress / totalDays;
    const offset = circumference - (progress * circumference);
    progressRing.style.strokeDashoffset = offset;
    
    // 更新週進度條
    updateWeekProgress();
}

// 更新週進度條
function updateWeekProgress() {
    const week1Progress = Math.min(Math.max(currentProgress, 0), 7) / 7;
    const week2Progress = Math.min(Math.max(currentProgress - 7, 0), 7) / 7;
    const week3Progress = Math.min(Math.max(currentProgress - 14, 0), 7) / 7;
    
    week1Fill.style.setProperty('--progress', `${week1Progress * 100}%`);
    week2Fill.style.setProperty('--progress', `${week2Progress * 100}%`);
    week3Fill.style.setProperty('--progress', `${week3Progress * 100}%`);
    
    // 使用CSS變數更新進度條寬度
    week1Fill.style.setProperty('--progress', `${week1Progress * 100}%`);
    week2Fill.style.setProperty('--progress', `${week2Progress * 100}%`);
    week3Fill.style.setProperty('--progress', `${week3Progress * 100}%`);
}

// 生成日曆
function generateCalendar() {
    calendarGrid.innerHTML = '';
    
    // 添加月份標題
    const monthTitle = document.createElement('div');
    monthTitle.className = 'calendar-month-title';
    monthTitle.style.cssText = `
        grid-column: 1 / -1;
        text-align: center;
        font-size: 1.3rem;
        font-weight: 600;
        color: #4a5568;
        margin-bottom: 15px;
        padding: 10px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 12px;
        border: 1px solid rgba(102, 126, 234, 0.2);
    `;
    
    monthTitle.textContent = '挑戰進度';
    
    calendarGrid.appendChild(monthTitle);
    
    // 添加星期標題 - 保持標準順序
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day weekday';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });
    
    // 生成21天的日曆格子，使用数字1-21
    // 第一天（8/27）是星期三，所以要从星期三那一列开始
    for (let i = 0; i < totalDays; i++) {
        const dayElement = document.createElement('div');
        const dayNumber = i + 1;
        
        // 計算這個天數應該放在哪一列
        // 第一天是星期三（第4列，索引3），所以偏移量是3
        const columnIndex = (i + 3) % 7; // 3是星期三的偏移量
        
        // 設置grid-column讓第一天從星期三開始
        dayElement.style.gridColumn = columnIndex + 1;
        
        // 顯示數字（1-21）
        dayElement.textContent = dayNumber;
        dayElement.dataset.day = dayNumber;
        
        // 添加基础样式类
        dayElement.classList.add('calendar-day-btn');
        
        // 檢查是否已簽到
        if (checkinData[dayNumber.toString()]) {
            dayElement.classList.add('checked');
            
            // 檢查是否為補簽到
            const isRetroactive = checkinData[dayNumber.toString()].is_retroactive;
            if (isRetroactive) {
                dayElement.classList.add('retroactive');
                // 補簽到標記（與正常簽到相同的叉叉）
                dayElement.innerHTML = `<span class="day-number">${dayNumber}</span><span class="check-mark">✗</span>`;
            } else {
                // 正常簽到標記（叉叉）
                dayElement.innerHTML = `<span class="day-number">${dayNumber}</span><span class="check-mark">✗</span>`;
            }
        } else {
            dayElement.innerHTML = `<span class="day-number">${dayNumber}</span>`;
        }
        
        // 檢查是否為今天（以4:00為界）
        const now = new Date();
        const startDate = new Date('2025-08-27T04:00:00'); // 從4:00開始計算
        const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const isToday = daysSinceStart === i;
        
        if (isToday) {
            dayElement.classList.add('today');
        } else if (i > daysSinceStart) {
            dayElement.classList.add('future');
        } else {
            dayElement.classList.add('past');
        }
        
        // 为非今天且已签到的日期添加删除功能
        if (!isToday && checkinData[dayNumber.toString()]) {
            dayElement.classList.add('deletable');
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'calendar-delete-btn';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.title = '删除签到记录';
            
            // 添加删除事件
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('确定要删除第' + dayNumber + '天的签到记录吗？')) {
                    await deleteCheckin(dayNumber.toString());
                }
            });
            
            dayElement.appendChild(deleteBtn);
            
            // 鼠标悬停时显示删除按钮
            dayElement.addEventListener('mouseenter', () => {
                deleteBtn.style.opacity = '1';
                deleteBtn.style.transform = 'scale(1.1)';
            });
            
            dayElement.addEventListener('mouseleave', () => {
                deleteBtn.style.opacity = '0';
                deleteBtn.style.transform = 'scale(1)';
            });
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

// 更新日曆
function updateCalendar() {
    const dayElements = document.querySelectorAll('.calendar-day:not(.weekday)');
    
    dayElements.forEach((dayElement) => {
        const dayNumber = dayElement.dataset.day;
        
        // 清除所有状态类
        dayElement.classList.remove('checked', 'future', 'today', 'past', 'deletable');
        
        // 检查是否为今天（以4:00为界）
        const now = new Date();
        const startDate = new Date('2025-08-27T04:00:00'); // 從4:00開始計算
        const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const isToday = daysSinceStart === parseInt(dayNumber) - 1;
        
        if (isToday) {
            dayElement.classList.add('today');
        } else if (parseInt(dayNumber) - 1 > daysSinceStart) {
            dayElement.classList.add('future');
        } else {
            dayElement.classList.add('past');
        }
        
        // 检查是否已签到
        if (checkinData[dayNumber]) {
            dayElement.classList.add('checked');
            
            // 檢查是否為補簽到
            const isRetroactive = checkinData[dayNumber].is_retroactive;
            if (isRetroactive) {
                dayElement.classList.add('retroactive');
                // 補簽到標記（與正常簽到相同的叉叉）
                dayElement.innerHTML = `<span class="day-number">${dayNumber}</span><span class="check-mark">✗</span>`;
            } else {
                // 正常簽到標記（叉叉）
                dayElement.innerHTML = `<span class="day-number">${dayNumber}</span><span class="check-mark">✗</span>`;
            }
            
            // 为非今天且已签到的日期添加删除功能
            if (!isToday) {
                dayElement.classList.add('deletable');
                
                // 检查是否已有删除按钮
                let deleteBtn = dayElement.querySelector('.calendar-delete-btn');
                if (!deleteBtn) {
                    // 创建删除按钮
                    deleteBtn = document.createElement('button');
                    deleteBtn.className = 'calendar-delete-btn';
                    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
                    deleteBtn.title = '删除签到记录';
                    
                    // 添加删除事件
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除第' + dayNumber + '天的签到记录吗？')) {
                            await deleteCheckin(dayNumber);
                        }
                    });
                    
                    dayElement.appendChild(deleteBtn);
                    
                    // 鼠标悬停时显示删除按钮
                    dayElement.addEventListener('mouseenter', () => {
                        deleteBtn.style.opacity = '1';
                        deleteBtn.style.transform = 'scale(1.1)';
                    });
                    
                    dayElement.addEventListener('mouseleave', () => {
                        deleteBtn.style.opacity = '0';
                        deleteBtn.style.transform = 'scale(1)';
                    });
                }
            }
        } else {
            // 未签到，只显示数字
            dayElement.innerHTML = `<span class="day-number">${dayNumber}</span>`;
        }
    });
}

// 簽到成功動畫
function animateCheckinSuccess() {
    checkinBtn.style.transform = 'scale(1.1)';
    checkinBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
    
    setTimeout(() => {
        checkinBtn.style.transform = 'scale(1)';
    }, 200);
    
    // 添加粒子效果
    createParticles();
}

// 創建粒子效果
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    particlesContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 999;
    `;
    
    document.body.appendChild(particlesContainer);
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: #48bb78;
            border-radius: 50%;
            pointer-events: none;
            animation: particle 1s ease-out forwards;
        `;
        
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.transform = 'translate(-50%, -50%)';
        
        const angle = (i / 20) * 360;
        const distance = 100 + Math.random() * 50;
        const x = Math.cos(angle * Math.PI / 180) * distance;
        const y = Math.sin(angle * Math.PI / 180) * distance;
        
        particle.style.setProperty('--x', x + 'px');
        particle.style.setProperty('--y', y + 'px');
        
        particlesContainer.appendChild(particle);
    }
    
    setTimeout(() => {
        document.body.removeChild(particlesContainer);
    }, 1000);
}

// 顯示完成特效
function showCompletionEffect() {
    completionOverlay.classList.add('show');
    
    // 播放音效（如果瀏覽器支持）
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        audio.play();
    } catch (e) {
        // 忽略音效錯誤
    }
    
    // 5秒後自動隱藏
    setTimeout(() => {
        completionOverlay.classList.remove('show');
    }, 5000);
}

// 顯示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#48bb78' : type === 'warning' ? '#ed8936' : '#4299e1'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        z-index: 1001;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 300px;
        font-weight: 500;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 動畫顯示
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自動隱藏
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS動畫樣式
const style = document.createElement('style');
style.textContent = `
    @keyframes particle {
        0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) scale(0);
            opacity: 0;
        }
    }
    
    .bar-fill::before {
        width: var(--progress, 0%) !important;
    }
`;
document.head.appendChild(style);

// 定期保存數據
setInterval(async () => {
    try {
        await fetch('/api/checkin', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: checkinData
            })
        });
    } catch (error) {
        console.error('保存數據失敗:', error);
    }
}, 30000); // 每30秒保存一次

// 添加鍵盤快捷鍵支持
document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        if (checkinBtn && !checkinBtn.classList.contains('completed')) {
            handleCheckin();
        }
    }
});

// 添加觸摸手勢支持（移動端）
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', function(e) {
    touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    
    // 向上滑動超過100px時刷新頁面
    if (swipeDistance > 100) {
        location.reload();
    }
});

// 添加頁面可見性檢測
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // 頁面重新可見時，只在必要時重新加載數據
        // 避免频繁的API调用
        if (Object.keys(checkinData).length === 0) {
            reloadDataAndUpdateUI();
        } else {
            // 如果本地有数据，只更新UI
            updateCheckinStatus();
            updateProgress();
            updateCalendar();
        }
    }
});

// 重新加載數據並更新UI
async function reloadDataAndUpdateUI() {
    try {
        // 從API重新加載簽到數據
        const response = await fetch('/api/checkin');
        if (response.ok) {
            const result = await response.json();
            checkinData = result.data;
            
            // 更新所有UI元素
            updateCheckinStatus();
            updateProgress();
            updateCalendar();
        }
    } catch (error) {
        console.error('重新加載數據失敗:', error);
    }
}

// 添加錯誤處理
window.addEventListener('error', function(e) {
    console.error('應用錯誤:', e.error);
    showNotification('發生了一些錯誤，請刷新頁面重試', 'warning');
});

// 添加離線檢測
window.addEventListener('offline', function() {
    showNotification('網絡連接已斷開，部分功能可能受限', 'warning');
});

window.addEventListener('online', function() {
    showNotification('網絡連接已恢復', 'success');
});

// 删除签到记录
async function deleteCheckin(dateString) {
    try {
        // 从本地数据中删除
        delete checkinData[dateString];
        
        // 更新UI
        updateCheckinStatus();
        updateProgress();
        updateCalendar();
        
        // 同步到服务器
        await fetch('/api/checkin', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: checkinData
            })
        });
        
        showNotification('签到记录已删除', 'success');
    } catch (error) {
        console.error('删除签到记录失败:', error);
        showNotification('删除失败，请重试', 'warning');
    }
}

// 初始化補簽到選項
function initializeRetroactiveOptions() {
    retroactiveDay.innerHTML = '<option value="">請選擇天數</option>';
    
    // 添加1-21天的選項，但只顯示未簽到的天數
    for (let i = 1; i <= totalDays; i++) {
        if (!checkinData[i.toString()]) {
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = `第${i}天`;
            retroactiveDay.appendChild(option);
        }
    }
}

// 顯示補簽到模态框
function showRetroactiveModal() {
    // 重新初始化選項
    initializeRetroactiveOptions();
    
    // 清空密碼輸入框
    retroactivePassword.value = '';
    
    // 顯示模态框
    retroactiveModal.classList.add('show');
    
    // 禁用確認按鈕直到選擇天數和輸入密碼
    modalConfirm.disabled = true;
    
    // 監聽輸入變化
    retroactiveDay.addEventListener('change', validateRetroactiveForm);
    retroactivePassword.addEventListener('input', validateRetroactiveForm);
}

// 隱藏補簽到模态框
function hideRetroactiveModal() {
    retroactiveModal.classList.remove('show');
    
    // 移除事件監聽器
    retroactiveDay.removeEventListener('change', validateRetroactiveForm);
    retroactivePassword.removeEventListener('input', validateRetroactiveForm);
}

// 驗證補簽到表單
function validateRetroactiveForm() {
    const hasDay = retroactiveDay.value !== '';
    const hasPassword = retroactivePassword.value.trim() !== '';
    modalConfirm.disabled = !(hasDay && hasPassword);
}

// 處理補簽到
async function handleRetroactiveCheckin() {
    const selectedDay = retroactiveDay.value;
    const password = retroactivePassword.value.trim();
    
    if (!selectedDay || !password) {
        showNotification('請選擇天數並輸入密碼', 'warning');
        return;
    }
    
    // 禁用確認按鈕防止重複提交
    modalConfirm.disabled = true;
    modalConfirm.textContent = '處理中...';
    
    try {
        const response = await fetch('/api/checkin/retroactive', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: selectedDay,
                password: password,
                timestamp: new Date().getTime()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            checkinData = result.data;
            
            // 更新UI
            updateCheckinStatus();
            updateProgress();
            updateCalendar();
            
            // 隱藏模态框
            hideRetroactiveModal();
            
            // 顯示成功通知
            showNotification(result.message, 'success');
            
            // 補簽到成功動畫
            animateRetroactiveSuccess();
            
            // 檢查是否完成挑戰
            if (Object.keys(checkinData).length >= totalDays) {
                setTimeout(showCompletionEffect, 1000);
            }
        } else {
            const error = await response.json();
            showNotification(error.detail || '補簽到失敗', 'warning');
        }
    } catch (error) {
        console.error('補簽到錯誤:', error);
        showNotification('補簽到失敗，請檢查網絡連接', 'warning');
    } finally {
        // 恢復按鈕狀態
        modalConfirm.disabled = false;
        modalConfirm.textContent = '確認補簽到';
    }
}

// 補簽到成功動畫
function animateRetroactiveSuccess() {
    // 添加特殊的補簽到成功效果
    const successOverlay = document.createElement('div');
    successOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(237, 137, 54, 0.1);
        z-index: 999;
        pointer-events: none;
        animation: retroactiveSuccess 2s ease-out forwards;
    `;
    
    document.body.appendChild(successOverlay);
    
    // 添加CSS動畫
    const style = document.createElement('style');
    style.textContent = `
        @keyframes retroactiveSuccess {
            0% {
                opacity: 0;
                transform: scale(1);
            }
            50% {
                opacity: 1;
                transform: scale(1.05);
            }
            100% {
                opacity: 0;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        document.body.removeChild(successOverlay);
        document.head.removeChild(style);
    }, 2000);
}
