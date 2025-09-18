# Настройка Google Sheets API для Scrum Poker

Для полноценной работы приложения с синхронизацией между участниками необходимо настроить Google Sheets API.

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Войдите в свой Google аккаунт
3. Создайте новый проект или выберите существующий:
   - Нажмите на выпадающий список проектов в верхней части
   - Нажмите "Новый проект"
   - Введите название проекта (например, "Scrum Poker App")
   - Нажмите "Создать"

## Шаг 2: Включение Google Sheets API

1. В боковом меню выберите "API и сервисы" → "Библиотека"
2. Найдите "Google Sheets API"
3. Нажмите на него и нажмите "Включить"

## Шаг 3: Создание API ключа

1. Перейдите в "API и сервисы" → "Учетные данные"
2. Нажмите "+ СОЗДАТЬ УЧЕТНЫЕ ДАННЫЕ" → "Ключ API"
3. Скопируйте созданный API ключ
4. (Рекомендуется) Ограничьте ключ:
   - Нажмите на ключ для редактирования
   - В разделе "Ограничения API" выберите "Ограничить ключ"
   - Выберите "Google Sheets API"
   - Сохраните изменения

## Шаг 4: Подготовка Google Sheets

1. Откройте [Google Sheets](https://sheets.google.com/)
2. Откройте вашу таблицу или создайте новую
3. Создайте лист с названием **"scrum-poker"** (точно как указано)
4. Настройте публичный доступ:
   - Нажмите "Настройки доступа" (кнопка "Поделиться")
   - Нажмите "Изменить" рядом с "Ограниченный доступ"
   - Выберите "Все, у кого есть ссылка"
   - Установите права "Читатель"
   - Нажмите "Готово"

## Шаг 5: Получение ID таблицы

Из URL вашей Google таблицы извлеките ID:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
```

Где `SPREADSHEET_ID` - это то, что вам нужно.

Например, из URL:
```
https://docs.google.com/spreadsheets/d/19-9wj5utmM3NMNGkUIu1vMPvTDczJC7D1eT9KyAZQIE/edit#gid=599470677
```

ID таблицы: `19-9wj5utmM3NMNGkUIu1vMPvTDczJC7D1eT9KyAZQIE`

## Шаг 6: Обновление конфигурации в коде

Откройте файл `script.js` и найдите секцию `SHEETS_CONFIG`:

```javascript
const SHEETS_CONFIG = {
    // Замените на ID вашей таблицы
    SPREADSHEET_ID: '19-9wj5utmM3NMNGkUIu1vMPvTDczJC7D1eT9KyAZQIE',
    // Замените на ваш API ключ
    API_KEY: 'YOUR_GOOGLE_SHEETS_API_KEY',
    RANGE: 'scrum-poker!A:F',
    UPDATE_INTERVAL: 3000
};
```

Замените:
- `SPREADSHEET_ID` на ID вашей таблицы
- `API_KEY` на ваш API ключ из шага 3

## Шаг 7: Реализация полной синхронизации (опционально)

Для полной реализации синхронизации с Google Sheets замените функции в `script.js`:

### Функция записи в Google Sheets:

```javascript
async function syncToSheets() {
    if (!currentSession || !currentPlayer) return;
    
    updateSyncStatus('syncing', 'Синхронизация...');
    
    try {
        const dataToWrite = [
            [currentSession, currentPlayer.id, currentPlayer.name, 
             JSON.stringify(currentPlayer.vote || ''), 
             sessionData.task, sessionData.isRevealed ? 'true' : 'false']
        ];
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.SPREADSHEET_ID}/values/${SHEETS_CONFIG.RANGE}:append?valueInputOption=RAW&key=${SHEETS_CONFIG.API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    values: dataToWrite
                })
            }
        );
        
        if (response.ok) {
            updateSyncStatus('synced', 'Синхронизировано');
        } else {
            throw new Error('Ошибка записи в Sheets');
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        updateSyncStatus('error', 'Ошибка синхронизации');
        
        // Fallback к localStorage
        const storageKey = `scrumPoker_${currentSession}`;
        // ... существующий код localStorage
    }
}
```

### Функция чтения из Google Sheets:

```javascript
async function syncFromSheets() {
    if (!currentSession) return;
    
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.SPREADSHEET_ID}/values/${SHEETS_CONFIG.RANGE}?key=${SHEETS_CONFIG.API_KEY}`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.values) {
                // Обработка данных из таблицы
                const sessionRows = data.values.filter(row => row[0] === currentSession);
                
                // Обновление локальных данных
                sessionData.players = {};
                sessionData.votes = {};
                
                sessionRows.forEach(row => {
                    const [session, playerId, playerName, vote, task, revealed] = row;
                    
                    sessionData.players[playerId] = {
                        id: playerId,
                        name: playerName,
                        vote: vote ? JSON.parse(vote) : null
                    };
                    
                    if (vote && vote !== 'null') {
                        sessionData.votes[playerId] = {
                            playerName,
                            vote: JSON.parse(vote),
                            timestamp: Date.now()
                        };
                    }
                    
                    if (task) sessionData.task = task;
                    if (revealed) sessionData.isRevealed = revealed === 'true';
                });
                
                updatePlayersDisplay();
                if (sessionData.isRevealed) {
                    showResults();
                }
            }
        }
    } catch (error) {
        console.error('Ошибка чтения из Sheets:', error);
        // Fallback к localStorage
        // ... существующий код localStorage
    }
}
```

## Шаг 8: Тестирование

1. Откройте приложение в нескольких вкладках браузера
2. Присоединитесь к одной сессии под разными именами
3. Проголосуйте и проверьте синхронизацию
4. Проверьте, что данные отображаются в Google Sheets

## Структура данных в Google Sheets

Таблица будет содержать следующие колонки:
- A: Session ID
- B: Player ID  
- C: Player Name
- D: Vote (JSON)
- E: Task Description
- F: Is Revealed (boolean)

## Ограничения и рекомендации

- **Квоты API**: Google Sheets API имеет лимиты на количество запросов
- **Частота обновлений**: Не устанавливайте интервал обновления менее 1 секунды
- **Безопасность**: API ключ будет виден в коде. Для продакшна рассмотрите использование серверной части
- **Производительность**: При большом количестве участников рассмотрите оптимизацию запросов

## Альтернативные решения

Если настройка Google Sheets API сложна, рассмотрите:
1. **Firebase Realtime Database** - простая настройка, реальное время
2. **WebRTC** - прямое соединение между клиентами
3. **WebSocket сервер** - если можете развернуть простой сервер
4. **Локальный режим** - использование только localStorage (текущая реализация)

## Устранение проблем

### Ошибка "API key not valid"
- Проверьте правильность API ключа
- Убедитесь, что Google Sheets API включен
- Проверьте ограничения API ключа

### Ошибка "The caller does not have permission"
- Убедитесь, что таблица имеет публичный доступ
- Проверьте права доступа к таблице

### Данные не синхронизируются
- Проверьте название листа (должен быть "scrum-poker")
- Проверьте ID таблицы в конфигурации
- Откройте консоль браузера для просмотра ошибок

---

**Удачной настройки! 🚀**