// Конфигурация Google Sheets
const SHEETS_CONFIG = {
    // Замените на ваш Google Sheets ID из URL
    SPREADSHEET_ID: '19-9wj5utmM3NMNGkUIu1vMPvTDczJC7D1eT9KyAZQIE',
    // Замените на ваш API ключ Google Sheets API
    API_KEY: 'AIzaSyBVbITYBK1yiEUhwA6qjCpLkS6eU3_UsfM',
    RANGE: 'scrum-poker!A:F',
    UPDATE_INTERVAL: 3000 // Интервал синхронизации в миллисекундах
};

// Глобальные переменные
let currentSession = null;
let currentPlayer = null;
let syncInterval = null;
let lastUpdateTime = 0;

// Данные сессии
let sessionData = {
    players: {},
    task: '',
    isRevealed: false,
    votes: {}
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Проверяем сохраненную сессию
    const savedSession = localStorage.getItem('scrumPokerSession');
    if (savedSession) {
        try {
            const sessionInfo = JSON.parse(savedSession);
            document.getElementById('playerName').value = sessionInfo.playerName;
            document.getElementById('sessionId').value = sessionInfo.sessionId;
        } catch (e) {
            console.log('Ошибка при загрузке сохраненной сессии');
        }
    }
    
    updateSyncStatus('disconnected', 'Не подключен');
}

// Присоединение к сессии
function joinSession() {
    const playerName = document.getElementById('playerName').value.trim();
    const sessionId = document.getElementById('sessionId').value.trim();
    
    if (!playerName || !sessionId) {
        alert('Пожалуйста, введите имя и ID сессии');
        return;
    }
    
    // Проверяем API ключ
    if (SHEETS_CONFIG.API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY') {
        alert('Необходимо настроить Google Sheets API ключ в файле script.js');
        showApiSetupInstructions();
        return;
    }
    
    currentSession = sessionId;
    currentPlayer = {
        name: playerName,
        id: generatePlayerId(),
        vote: null,
        joinedAt: Date.now()
    };
    
    // Сохраняем сессию
    localStorage.setItem('scrumPokerSession', JSON.stringify({
        playerName,
        sessionId
    }));
    
    // Переключаемся на игровой экран
    switchScreen('gameScreen');
    updateSessionInfo();
    
    // Добавляем игрока в сессию
    addPlayerToSession();
    
    // Запускаем синхронизацию
    startSync();
}

// Покидание сессии
function leaveSession() {
    if (confirm('Вы уверены, что хотите покинуть сессию?')) {
        // Удаляем игрока из сессии
        removePlayerFromSession();
        
        // Останавливаем синхронизацию
        stopSync();
        
        // Очищаем данные
        currentSession = null;
        currentPlayer = null;
        sessionData = { players: {}, task: '', isRevealed: false, votes: {} };
        
        // Переключаемся на экран входа
        switchScreen('loginScreen');
    }
}

// Переключение экранов
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Обновление информации о сессии
function updateSessionInfo() {
    document.getElementById('currentSessionId').textContent = `Сессия: ${currentSession}`;
    document.getElementById('currentPlayerName').textContent = currentPlayer.name;
}

// Выбор карты
function selectCard(value) {
    // Убираем выделение с других карт
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Выделяем выбранную карту
    const selectedCard = document.querySelector(`[data-value="${value}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Сохраняем голос
    currentPlayer.vote = value;
    sessionData.votes[currentPlayer.id] = {
        playerName: currentPlayer.name,
        vote: value,
        timestamp: Date.now()
    };
    
    // Обновляем отображение игроков
    updatePlayersDisplay();
    
    // Синхронизируем с Google Sheets
    syncToSheets();
}

// Обновление задачи
function updateTask() {
    const task = document.getElementById('currentTask').value.trim();
    if (task) {
        sessionData.task = task;
        document.getElementById('taskDisplay').textContent = task;
        document.getElementById('currentTask').value = '';
        
        // Синхронизируем с Google Sheets
        syncToSheets();
    }
}

// Показать карты
function revealCards() {
    sessionData.isRevealed = true;
    updatePlayersDisplay();
    showResults();
    
    // Синхронизируем с Google Sheets
    syncToSheets();
}

// Сброс голосования
function resetVoting() {
    sessionData.isRevealed = false;
    sessionData.votes = {};
    currentPlayer.vote = null;
    
    // Убираем выделение с карт
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Скрываем результаты
    document.getElementById('results').style.display = 'none';
    
    // Обновляем отображение
    updatePlayersDisplay();
    
    // Синхронизируем с Google Sheets
    syncToSheets();
}

// Обновление отображения игроков
function updatePlayersDisplay() {
    const playersList = document.getElementById('playersList');
    const playersCount = document.getElementById('playersCount');
    
    playersList.innerHTML = '';
    
    const allPlayers = {...sessionData.players};
    // Добавляем текущего игрока, если его нет в списке
    if (currentPlayer && !allPlayers[currentPlayer.id]) {
        allPlayers[currentPlayer.id] = currentPlayer;
    }
    
    const playersArray = Object.values(allPlayers);
    playersCount.textContent = playersArray.length;
    
    playersArray.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        if (player.id === currentPlayer?.id) {
            playerCard.classList.add('current-player');
        }
        
        const hasVote = sessionData.votes[player.id];
        if (hasVote) {
            playerCard.classList.add('voted');
        }
        
        const playerName = document.createElement('div');
        playerName.className = 'player-name';
        playerName.textContent = player.name;
        
        const playerVote = document.createElement('div');
        playerVote.className = 'player-vote';
        
        if (hasVote) {
            if (sessionData.isRevealed) {
                playerVote.textContent = sessionData.votes[player.id].vote;
            } else {
                playerVote.classList.add('hidden');
            }
        } else {
            playerVote.textContent = '-';
        }
        
        playerCard.appendChild(playerName);
        playerCard.appendChild(playerVote);
        playersList.appendChild(playerCard);
    });
}

// Показать результаты голосования
function showResults() {
    const resultsDiv = document.getElementById('results');
    const votingResults = document.getElementById('votingResults');
    
    // Подсчитываем голоса
    const votesCounts = {};
    const validVotes = [];
    
    Object.values(sessionData.votes).forEach(vote => {
        const value = vote.vote;
        votesCounts[value] = (votesCounts[value] || 0) + 1;
        if (typeof value === 'number' && value >= 0) {
            validVotes.push(value);
        }
    });
    
    // Создаем отображение результатов
    const votingSummary = document.createElement('div');
    votingSummary.className = 'voting-summary';
    
    Object.keys(votesCounts).forEach(value => {
        const voteResult = document.createElement('div');
        voteResult.className = 'vote-result';
        
        const voteValue = document.createElement('div');
        voteValue.className = 'vote-value';
        voteValue.textContent = value;
        
        const voteCount = document.createElement('div');
        voteCount.className = 'vote-count';
        voteCount.textContent = `${votesCounts[value]} голос${getVoteWord(votesCounts[value])}`;
        
        voteResult.appendChild(voteValue);
        voteResult.appendChild(voteCount);
        votingSummary.appendChild(voteResult);
    });
    
    // Анализируем консенсус
    const consensus = document.createElement('div');
    consensus.className = 'consensus';
    
    const uniqueVotes = Object.keys(votesCounts).filter(vote => 
        typeof parseFloat(vote) === 'number' && !isNaN(parseFloat(vote))
    );
    
    if (uniqueVotes.length === 1 && validVotes.length > 1) {
        consensus.className += ' success';
        consensus.textContent = `🎉 Консенсус достигнут! Оценка: ${uniqueVotes[0]}`;
    } else if (validVotes.length > 0) {
        const avg = validVotes.reduce((a, b) => a + b, 0) / validVotes.length;
        consensus.className += ' warning';
        consensus.textContent = `📊 Разброс мнений. Средняя оценка: ${avg.toFixed(1)}. Обсудите результаты.`;
    } else {
        consensus.textContent = '🤔 Недостаточно числовых оценок для анализа.';
    }
    
    votingResults.innerHTML = '';
    votingResults.appendChild(votingSummary);
    votingResults.appendChild(consensus);
    
    resultsDiv.style.display = 'block';
}

// Вспомогательные функции
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getVoteWord(count) {
    if (count === 1) return '';
    if (count >= 2 && count <= 4) return 'а';
    return 'ов';
}

// Работа с Google Sheets API
function addPlayerToSession() {
    updateSyncStatus('syncing', 'Присоединение к сессии...');
    syncToSheets();
}

function removePlayerFromSession() {
    // Удаляем игрока из локальных данных
    if (currentPlayer && sessionData.players[currentPlayer.id]) {
        delete sessionData.players[currentPlayer.id];
    }
    if (currentPlayer && sessionData.votes[currentPlayer.id]) {
        delete sessionData.votes[currentPlayer.id];
    }
    
    syncToSheets();
}

function syncToSheets() {
    if (!currentSession || !currentPlayer) return;
    
    updateSyncStatus('syncing', 'Синхронизация...');
    
    // Подготавливаем данные для отправки
    const dataToSend = {
        session: currentSession,
        player: currentPlayer,
        sessionData: {
            ...sessionData,
            players: {
                ...sessionData.players,
                [currentPlayer.id]: currentPlayer
            }
        },
        timestamp: Date.now()
    };
    
    // Эмуляция синхронизации (в реальной версии здесь будет запрос к Google Sheets API)
    setTimeout(() => {
        // Сохраняем в localStorage как fallback
        const storageKey = `scrumPoker_${currentSession}`;
        let existingData = {};
        try {
            existingData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        } catch (e) {}
        
        // Обновляем данные
        existingData.players = existingData.players || {};
        existingData.players[currentPlayer.id] = currentPlayer;
        existingData.task = sessionData.task;
        existingData.isRevealed = sessionData.isRevealed;
        existingData.votes = sessionData.votes;
        existingData.lastUpdate = Date.now();
        
        localStorage.setItem(storageKey, JSON.stringify(existingData));
        
        updateSyncStatus('synced', 'Синхронизировано');
    }, 500);
}

function syncFromSheets() {
    if (!currentSession) return;
    
    const storageKey = `scrumPoker_${currentSession}`;
    try {
        const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (data.lastUpdate && data.lastUpdate > lastUpdateTime) {
            // Обновляем локальные данные
            if (data.players) {
                sessionData.players = data.players;
            }
            if (data.task !== undefined) {
                sessionData.task = data.task;
                document.getElementById('taskDisplay').textContent = data.task || '';
            }
            if (data.isRevealed !== undefined) {
                sessionData.isRevealed = data.isRevealed;
                if (data.isRevealed) {
                    showResults();
                } else {
                    document.getElementById('results').style.display = 'none';
                }
            }
            if (data.votes) {
                sessionData.votes = data.votes;
                // Обновляем выбранную карту, если голос изменился
                const myVote = data.votes[currentPlayer?.id];
                if (myVote && currentPlayer) {
                    currentPlayer.vote = myVote.vote;
                    document.querySelectorAll('.card').forEach(card => {
                        card.classList.remove('selected');
                    });
                    const selectedCard = document.querySelector(`[data-value="${myVote.vote}"]`);
                    if (selectedCard) {
                        selectedCard.classList.add('selected');
                    }
                }
            }
            
            lastUpdateTime = data.lastUpdate;
            updatePlayersDisplay();
        }
    } catch (e) {
        console.log('Ошибка при загрузке данных из хранилища:', e);
    }
}

function startSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    syncInterval = setInterval(() => {
        syncFromSheets();
    }, SHEETS_CONFIG.UPDATE_INTERVAL);
    
    // Первая синхронизация
    syncFromSheets();
}

function stopSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    updateSyncStatus('disconnected', 'Не подключен');
}

function updateSyncStatus(status, text) {
    const syncStatus = document.getElementById('syncStatus');
    const syncIndicator = document.getElementById('syncIndicator');
    const syncText = document.getElementById('syncText');
    
    syncStatus.className = `sync-status ${status}`;
    
    switch (status) {
        case 'syncing':
            syncIndicator.textContent = '🔄';
            break;
        case 'synced':
            syncIndicator.textContent = '✅';
            setTimeout(() => {
                if (syncText.textContent === text) {
                    updateSyncStatus('connected', 'Подключен');
                }
            }, 2000);
            break;
        case 'connected':
            syncIndicator.textContent = '🟢';
            break;
        case 'error':
            syncIndicator.textContent = '❌';
            break;
        case 'disconnected':
            syncIndicator.textContent = '🔴';
            break;
    }
    
    syncText.textContent = text;
}

// Инструкции по настройке API
function showApiSetupInstructions() {
    const instructions = `
Для работы приложения необходимо настроить Google Sheets API:

1. Перейдите на https://console.developers.google.com/
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API
4. Создайте API ключ
5. Замените 'YOUR_GOOGLE_SHEETS_API_KEY' в script.js на ваш API ключ
6. Убедитесь, что ваша Google таблица публично доступна для чтения

Текущее демо работает с localStorage для демонстрации функциональности.
    `;
    
    alert(instructions);
}

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Ошибка приложения:', e.error);
    updateSyncStatus('error', 'Ошибка синхронизации');
});

// Обработка потери соединения
window.addEventListener('offline', function() {
    updateSyncStatus('error', 'Нет соединения');
});

window.addEventListener('online', function() {
    if (currentSession) {
        updateSyncStatus('syncing', 'Восстановление соединения...');
        syncToSheets();
    }
});