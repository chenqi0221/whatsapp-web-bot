const socket = io();
let selectedChat = null;

socket.on('connect', () => {
    console.log('Connected to server');
});

// 页面加载时恢复保存的消息模板
function loadSavedMessages() {
    try {
        const savedMessages = JSON.parse(
            localStorage.getItem('broadcastMessages') || '[]',
        );
        if (savedMessages.length > 0) {
            for (let i = 0; i < savedMessages.length && i < 5; i++) {
                const el = document.getElementById(
                    'broadcastMessage' + (i + 1),
                );
                if (el) el.value = savedMessages[i];
            }
        }

        // 恢复其他设置
        const savedInterval = localStorage.getItem('broadcastInterval');
        if (savedInterval) {
            document.getElementById('broadcastInterval').value = savedInterval;
        }

        const savedUseTemplates = localStorage.getItem('useTemplates');
        if (savedUseTemplates !== null) {
            document.getElementById('useTemplates').checked =
                savedUseTemplates === 'true';
        }

        const savedRandomInterval = localStorage.getItem('randomInterval');
        if (savedRandomInterval !== null) {
            document.getElementById('randomInterval').checked =
                savedRandomInterval === 'true';
        }

        const savedRandomizeMsg = localStorage.getItem('randomizeMsg');
        if (savedRandomizeMsg !== null) {
            document.getElementById('randomizeMsg').checked =
                savedRandomizeMsg === 'true';
        }

        const savedLengthRandomize = localStorage.getItem('lengthRandomize');
        if (savedLengthRandomize !== null) {
            document.getElementById('lengthRandomize').checked =
                savedLengthRandomize === 'true';
        }

        const savedSimulateTyping = localStorage.getItem('simulateTyping');
        if (savedSimulateTyping !== null) {
            document.getElementById('simulateTyping').checked =
                savedSimulateTyping === 'true';
        }

        const savedSimulateMouse = localStorage.getItem('simulateMouse');
        if (savedSimulateMouse !== null) {
            document.getElementById('simulateMouse').checked =
                savedSimulateMouse === 'true';
        }

        const savedRespectHours = localStorage.getItem('respectHours');
        if (savedRespectHours !== null) {
            document.getElementById('respectHours').checked =
                savedRespectHours === 'true';
        }

        const savedRandomPause = localStorage.getItem('randomPause');
        if (savedRandomPause !== null) {
            document.getElementById('randomPause').checked =
                savedRandomPause === 'true';
        }

        const savedPersonalize = localStorage.getItem('personalize');
        if (savedPersonalize !== null) {
            document.getElementById('personalize').checked =
                savedPersonalize === 'true';
        }
    } catch (e) {
        console.log('Error loading saved messages:', e);
    }
}

// 保存消息模板到本地存储
function saveMessages() {
    try {
        const messages = [];
        for (let i = 1; i <= 5; i++) {
            const msg = document
                .getElementById('broadcastMessage' + i)
                ?.value?.trim();
            if (msg) {
                messages.push(msg);
            }
        }
        localStorage.setItem('broadcastMessages', JSON.stringify(messages));

        // 保存其他设置
        localStorage.setItem(
            'broadcastInterval',
            document.getElementById('broadcastInterval').value,
        );
        localStorage.setItem(
            'useTemplates',
            document.getElementById('useTemplates').checked,
        );
        localStorage.setItem(
            'randomInterval',
            document.getElementById('randomInterval').checked,
        );
        localStorage.setItem(
            'randomizeMsg',
            document.getElementById('randomizeMsg').checked,
        );
        localStorage.setItem(
            'lengthRandomize',
            document.getElementById('lengthRandomize').checked,
        );
        localStorage.setItem(
            'simulateTyping',
            document.getElementById('simulateTyping').checked,
        );
        localStorage.setItem(
            'simulateMouse',
            document.getElementById('simulateMouse').checked,
        );
        localStorage.setItem(
            'respectHours',
            document.getElementById('respectHours').checked,
        );
        localStorage.setItem(
            'randomPause',
            document.getElementById('randomPause').checked,
        );
        localStorage.setItem(
            'personalize',
            document.getElementById('personalize').checked,
        );
    } catch (e) {
        console.log('Error saving messages:', e);
    }
}

// 页面加载时恢复
window.addEventListener('load', () => {
    loadSavedMessages();
    loadSavedSessions();
});

async function loadSavedSessions() {
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();
        const sessions = data.sessions || [];

        const list = document.getElementById('accountList');

        if (sessions.length > 0) {
            list.innerHTML = sessions
                .map((s) => {
                    const date = new Date(s.lastUsed).toLocaleString();
                    return `
                    <div class="account-card" style="border: 1px solid #ddd; border-radius: 8px; padding: 12px; min-width: 200px; background: #fff;">
                        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px">${s.name}</div>
                        <div style="color: #999; font-size: 12px; margin-bottom: 8px">上次使用: ${date}</div>
                        <div style="display: flex; gap: 6px">
                            <button class="btn btn-primary btn-sm" onclick="connectAccount('${s.id}')">登录</button>
                            <button class="btn btn-info btn-sm" onclick="renameAccount('${s.id}', '${s.name}')">重命名</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteAccount('${s.id}')">删除</button>
                        </div>
                    </div>
                `;
                })
                .join('');
        } else {
            list.innerHTML =
                '<p style="color: #999">暂无保存的账号，请点击"新建账号"开始</p>';
        }
    } catch (e) {
        console.log('Error loading sessions:', e);
    }
}

async function createNewAccount() {
    const name = prompt('请输入新账号名称（如：工作号、私人号）:', '新账号');
    if (!name) return;

    try {
        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceNew: true, accountName: name }),
        });
        const result = await response.json();

        if (result.success) {
            console.log('New account created:', result.clientId);
        } else {
            alert(result.error || result.message);
        }
    } catch (error) {
        console.error('Error creating account:', error);
        alert('创建账号失败');
    }
}

async function connectAccount(clientId) {
    try {
        // 显示加载状态
        const list = document.getElementById('accountList');
        list.innerHTML = '<p style="color: #666">正在切换账号...</p>';

        const response = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId }),
        });
        const result = await response.json();

        if (result.success) {
            console.log('Connecting account:', clientId);
        } else {
            alert(result.error || result.message);
            loadSavedSessions(); // 恢复列表显示
        }
    } catch (error) {
        console.error('Error connecting account:', error);
        alert('连接账号失败');
        loadSavedSessions(); // 恢复列表显示
    }
}

async function renameAccount(id, currentName) {
    const newName = prompt('请输入新名称:', currentName);
    if (!newName || newName === currentName) return;

    try {
        const response = await fetch('/api/account/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name: newName }),
        });
        const result = await response.json();

        if (result.success) {
            loadSavedSessions();
        } else {
            alert('重命名失败');
        }
    } catch (error) {
        console.error('Error renaming account:', error);
    }
}

async function deleteAccount(id) {
    if (!confirm('确定要删除这个账号吗？对应的聊天记录也会被删除。')) return;

    try {
        const response = await fetch('/api/account/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        const result = await response.json();

        if (result.success) {
            loadSavedSessions();
        } else {
            alert('删除失败');
        }
    } catch (error) {
        console.error('Error deleting account:', error);
    }
}

async function connectWhatsApp() {
    createNewAccount();
}

socket.on('status', (data) => {
    updateStatus(data.status, data.qr);
});

socket.on('new_account_detected', (data) => {
    const name = prompt(data.message + '\n请输入账号名称:', '新账号');
    if (name) {
        fetch('/api/account/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: data.clientId, name }),
        }).then(() => {
            loadSavedSessions();
        });
    }
});

socket.on('message', (data) => {
    addMessage(data);
});

socket.on('broadcast-progress', (data) => {
    updateBroadcastProgress(data);
});

socket.on('auto-reply-rules', (data) => {
    renderAutoReplyRules(data.rules);
});

socket.on('scheduled-tasks', (data) => {
    renderScheduledTasks(data.tasks);
});

socket.on('contact-test-progress', (data) => {
    updateContactTestProgress(data);
});

socket.on('scheduled-task', (data) => {
    alert(`定时任务 "${data.name}" 已执行，发送了 ${data.sentCount} 条消息`);
});

socket.on('auto-reply', (data) => {
    console.log('Auto reply triggered:', data);
});

socket.on('broadcast-current', (data) => {
    updateActivityPanel(data);
});

function updateActivityPanel(data) {
    const currentActivity = document.getElementById('currentActivity');
    const currentContact = document.getElementById('currentContact');
    const broadcastProgressText = document.getElementById(
        'broadcastProgressText',
    );
    const successFailCount = document.getElementById('successFailCount');
    const dailySentCount = document.getElementById('dailySentCount');
    const activityProgressFill = document.getElementById(
        'activityProgressFill',
    );

    if (data.status === 'sending') {
        currentActivity.textContent = '正在发送...';
        currentActivity.className = 'activity-value active';
    } else if (data.status === 'success') {
        currentActivity.textContent = '发送成功';
        currentActivity.className = 'activity-value success';
    } else if (data.status === 'failed') {
        currentActivity.textContent = '发送失败';
        currentActivity.className = 'activity-value error';
    }

    currentContact.textContent = data.name || data.number || '-';
    broadcastProgressText.textContent = data.index + ' / ' + data.total;

    // 更新进度条
    const percent =
        data.total > 0 ? Math.round((data.index / data.total) * 100) : 0;
    activityProgressFill.style.width = percent + '%';
    activityProgressFill.textContent = percent + '%';
}

function showTab(tabId) {
    document
        .querySelectorAll('.tab-content')
        .forEach((t) => t.classList.remove('active'));
    document
        .querySelectorAll('.tab-btn')
        .forEach((b) => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');

    const tabsNeedingChats = [
        'messages',
        'group',
        'chat',
        'media',
        'location',
        'poll',
        'sticker',
        'label',
    ];
    if (tabsNeedingChats.includes(tabId)) {
        loadChats();
    }

    if (tabId === 'channel') {
        loadChannels();
    }

    if (tabId === 'label') {
        loadLabels();
    }
}

function updateStatus(status, qr) {
    const badge = document.getElementById('statusBadge');
    const qrSection = document.getElementById('qrSection');
    const qrImage = document.getElementById('qrImage');
    const connectSection = document.getElementById('connectSection');
    const connectBtn = document.getElementById('connectBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    badge.className = 'status-badge status-' + status;
    badge.textContent =
        {
            disconnected: '未连接',
            authenticated: '验证中',
            qr: '等待扫码',
            ready: '已就绪',
            retrying: '重试中',
            auth_failure: '连接失败',
        }[status] || status;

    // 管理按钮显示
    if (status === 'disconnected') {
        connectSection.style.display = 'block';
        connectBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        connectBtn.disabled = false;
        connectBtn.textContent = '连接 WhatsApp';
    } else if (status === 'ready') {
        connectSection.style.display = 'block';
        connectBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        logoutBtn.disabled = false;
        logoutBtn.textContent = '退出登录';
        const accountSection = document.getElementById('accountSection');
        if (accountSection) accountSection.style.display = 'none';
    } else {
        connectSection.style.display = 'none';
    }

    const activityPanel = document.getElementById('activityPanel');

    if (status === 'qr' && qr) {
        qrSection.style.display = 'block';
        activityPanel.style.display = 'none';
        qrImage.src =
            'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' +
            encodeURIComponent(qr);
    } else if (status === 'ready') {
        qrSection.style.display = 'none';
        activityPanel.style.display = 'block';
    } else {
        qrSection.style.display = 'none';
        activityPanel.style.display = 'none';
    }

    if (status === 'ready') {
        loadChats();
    }
}

async function logoutWhatsApp() {
    if (
        !confirm('确定要退出登录吗？这将清除所有登录数据，下次需要重新扫码。')
    ) {
        return;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.disabled = true;
    logoutBtn.textContent = '退出中...';

    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
        });
        const result = await response.json();

        if (result.success) {
            alert('已退出登录');
            location.reload();
        } else {
            alert('退出失败: ' + result.error);
            logoutBtn.disabled = false;
            logoutBtn.textContent = '退出登录';
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('退出失败');
        logoutBtn.disabled = false;
        logoutBtn.textContent = '退出登录';
    }
}

async function loadChats() {
    const response = await fetch('/api/chats');
    const data = await response.json();

    const chatList = document.getElementById('chatList');
    const chatSelect = document.getElementById('chatSelect');
    const groupSelect = document.getElementById('groupSelect');
    const manageChatSelect = document.getElementById('manageChatSelect');
    const mediaChatSelect = document.getElementById('mediaChatSelect');
    const locationChatSelect = document.getElementById('locationChatSelect');
    const pollChatSelect = document.getElementById('pollChatSelect');
    const stickerChatSelect = document.getElementById('stickerChatSelect');
    const labelChatSelect = document.getElementById('labelChatSelect');

    if (chatList) {
        chatList.innerHTML = '';
        data.chats.forEach((chat) => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            chatItem.innerHTML = `
                <div>
                    <div class="chat-name">${chat.name || chat.id}</div>
                    <div class="chat-preview">${chat.lastMessage || ''}</div>
                </div>
                <span class="chat-tag ${chat.isGroup ? 'tag-group' : 'tag-private'}">
                    ${chat.isGroup ? '群组' : '私聊'}
                </span>
            `;
            chatItem.onclick = () => selectChatItem(chat, chatItem);
            chatList.appendChild(chatItem);
        });

        if (data.chats.length === 0) {
            chatList.innerHTML = '<div class="empty-state">暂无聊天记录</div>';
        }
    }

    [
        chatSelect,
        groupSelect,
        manageChatSelect,
        mediaChatSelect,
        locationChatSelect,
        pollChatSelect,
        stickerChatSelect,
        labelChatSelect,
    ].forEach((select) => {
        if (select) {
            select.innerHTML = '<option value="">-- 选择 --</option>';
            data.chats.forEach((chat) => {
                const option = document.createElement('option');
                option.value = chat.id;
                option.textContent = chat.name || chat.id;
                select.appendChild(option);
            });
        }
    });
}

function selectChatItem(chat, element) {
    selectedChat = chat;
    document
        .querySelectorAll('.chat-item')
        .forEach((i) => i.classList.remove('selected'));
    element.classList.add('selected');
}

function selectChat() {
    const chatId = document.getElementById('chatSelect').value;
    selectedChat = { id: chatId };
}

async function sendSingleMessage() {
    const message = document.getElementById('singleMessage').value;
    if (!selectedChat || !selectedChat.id) {
        alert('请选择联系人');
        return;
    }
    if (!message) {
        alert('请输入消息内容');
        return;
    }

    const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: selectedChat.id, message }),
    });

    const result = await response.json();
    if (result.success) {
        alert('发送成功！');
        document.getElementById('singleMessage').value = '';
    } else {
        alert('发送失败: ' + result.error);
    }
}

function toggleManualInput() {
    const targetType = document.getElementById('targetType').value;
    document.getElementById('manualInputSection').style.display =
        targetType === 'manual' ? 'block' : 'none';
}

function updateAccountLevelInfo() {
    const level = document.getElementById('accountLevel').value;
    const infoDiv = document.getElementById('accountLevelInfo');

    const levelInfo = {
        new: '<strong>新账号限制（注册<30天）：</strong><br>• 每天最多30条<br>• 每小时最多5条<br>• 最小间隔60秒<br>• 每批5条后暂停3分钟',
        established:
            '<strong>稳定账号限制（30-90天）：</strong><br>• 每天最多80条<br>• 每小时最多10条<br>• 最小间隔30秒<br>• 每批10条后暂停2分钟',
        mature: '<strong>老账号限制（>90天）：</strong><br>• 每天最多150条<br>• 每小时最多20条<br>• 最小间隔20秒<br>• 每批15条后暂停1分钟',
    };

    const colors = {
        new: '#fff3e0',
        established: '#e8f5e9',
        mature: '#e3f2fd',
    };

    infoDiv.innerHTML = levelInfo[level];
    infoDiv.style.background = colors[level];
}

async function testGetContacts() {
    const targetType = document.getElementById('targetType').value;

    if (targetType === 'manual') {
        const numbersText = document.getElementById('manualNumbers').value;
        const lines = numbersText.split('\n').filter((l) => l.trim());
        document.getElementById('contactCount').innerHTML =
            '<span style="color:green">手动输入 ' +
            lines.length +
            ' 个号码</span>';
        return;
    }

    if (targetType === 'contacts') {
        const response = await fetch('/api/contacts-list');
        const data = await response.json();
        if (data.error) {
            document.getElementById('contactCount').innerHTML =
                '<span style="color:red">错误: ' + data.error + '</span>';
        } else {
            document.getElementById('contactCount').innerHTML =
                '<span style="color:green">所有联系人: ' +
                data.total +
                ' 个</span>';
        }
    } else if (targetType === 'nohistory') {
        const response = await fetch('/api/contacts-list');
        const data = await response.json();
        if (data.error) {
            document.getElementById('contactCount').innerHTML =
                '<span style="color:red">错误: ' + data.error + '</span>';
        } else {
            const chatsRes = await fetch('/api/chats');
            const chatsData = await chatsRes.json();

            // 构建聊天记录的 ID 集合（多种格式）
            const chatNumbers = new Set();
            const chatLids = new Set();
            const chatNames = new Set();

            if (chatsData.chats) {
                for (const chat of chatsData.chats) {
                    const chatId = chat.id;
                    if (chatId && typeof chatId === 'string') {
                        const match = chatId.match(/^(\d+)@/);
                        if (match) chatNumbers.add(match[1]);
                        const lidMatch = chatId.match(/^(\d+)@lid/);
                        if (lidMatch) chatLids.add(lidMatch[1]);
                    }
                    if (chat.name) {
                        chatNames.add(chat.name.toLowerCase().trim());
                    }
                }
            }

            const noHistoryCount = data.contacts.filter((c) => {
                const inChatsByLid =
                    c.lid && (chatNumbers.has(c.lid) || chatLids.has(c.lid));
                const inChatsByNumber = c.number && chatNumbers.has(c.number);
                const inChatsById = c.id && chatNumbers.has(c.id.split('@')[0]);
                const nameMatch = c.name
                    ? chatNames.has(c.name.toLowerCase().trim())
                    : false;

                return (
                    !inChatsByLid &&
                    !inChatsByNumber &&
                    !inChatsById &&
                    !nameMatch
                );
            }).length;

            document.getElementById('contactCount').innerHTML =
                '<span style="color:green">未聊天联系人: ' +
                noHistoryCount +
                ' 个</span>';
        }
    } else {
        // 获取已有聊天
        const response = await fetch('/api/chats');
        const data = await response.json();
        if (data.error) {
            document.getElementById('contactCount').innerHTML =
                '<span style="color:red">错误: ' + data.error + '</span>';
        } else {
            const excludeGroups =
                document.getElementById('excludeGroups').checked;
            const count = excludeGroups
                ? data.chats.filter((c) => !c.isGroup).length
                : data.chats.length;
            document.getElementById('contactCount').innerHTML =
                '<span style="color:green">已有聊天: ' + count + ' 个</span>';
        }
    }
}

function exportContacts() {
    window.open('/api/export-contacts', '_blank');
}

async function startContactTestLoop() {
    const maxAttemptsEl = document.getElementById('maxAttempts');
    const testIntervalEl = document.getElementById('testInterval');
    const stopOnSuccessEl = document.getElementById('stopOnSuccess');

    if (!maxAttemptsEl || !testIntervalEl || !stopOnSuccessEl) {
        return;
    }

    const maxAttempts = parseInt(maxAttemptsEl.value);
    const interval = parseInt(testIntervalEl.value);
    const stopOnSuccess = stopOnSuccessEl.checked;

    const response = await fetch('/api/contact-test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            maxAttempts,
            interval,
            stopOnSuccess,
        }),
    });

    const result = await response.json();
    const startTestLoop = document.getElementById('startTestLoop');
    const stopTestLoop = document.getElementById('stopTestLoop');
    const testStatus = document.getElementById('testStatus');

    if (result.success && startTestLoop && stopTestLoop && testStatus) {
        startTestLoop.disabled = true;
        stopTestLoop.disabled = false;
        testStatus.textContent = '运行中...';
    } else if (!result.success) {
        alert('启动失败: ' + result.error);
    }
}

async function stopContactTestLoop() {
    const response = await fetch('/api/contact-test/stop', {
        method: 'POST',
    });

    const result = await response.json();
    const startTestLoop = document.getElementById('startTestLoop');
    const stopTestLoop = document.getElementById('stopTestLoop');
    const testStatus = document.getElementById('testStatus');

    if (result.success && startTestLoop && stopTestLoop && testStatus) {
        startTestLoop.disabled = false;
        stopTestLoop.disabled = true;
        testStatus.textContent = '已停止';
    }
}

function updateContactTestProgress(data) {
    // 检查元素是否存在再进行操作
    const testAttempts = document.getElementById('testAttempts');
    if (testAttempts) testAttempts.textContent = data.attempts;

    const testStatus = document.getElementById('testStatus');
    const startTestLoop = document.getElementById('startTestLoop');
    const stopTestLoop = document.getElementById('stopTestLoop');

    if (testStatus && startTestLoop && stopTestLoop) {
        if (data.running) {
            testStatus.textContent = '运行中...';
            startTestLoop.disabled = true;
            stopTestLoop.disabled = false;
        } else if (data.attempts > 0) {
            testStatus.textContent = '已停止';
            startTestLoop.disabled = false;
            stopTestLoop.disabled = true;
        }
    }

    const testResult = document.getElementById('testResult');
    if (testResult && data.lastResult) {
        if (data.lastResult.success) {
            testResult.innerHTML =
                '<span style="color:green">成功! 获取到 ' +
                data.lastResult.count +
                ' 个联系人</span>';
        } else if (data.lastResult.error) {
            testResult.innerHTML =
                '<span style="color:red">错误: ' +
                data.lastResult.error +
                '</span>';
        } else {
            testResult.textContent = '0 个联系人';
        }
    }
}

async function startBroadcast() {
    const useTemplates = document.getElementById('useTemplates').checked;
    const interval = parseInt(
        document.getElementById('broadcastInterval').value,
    );
    const randomInterval = document.getElementById('randomInterval').checked;
    const randomizeMsg = document.getElementById('randomizeMsg').checked;
    const lengthRandomize = document.getElementById('lengthRandomize').checked;
    const simulateTyping = document.getElementById('simulateTyping').checked;
    const simulateMouse = document.getElementById('simulateMouse').checked;
    const respectHours = document.getElementById('respectHours').checked;
    const randomPause = document.getElementById('randomPause').checked;
    const excludeGroups = document.getElementById('excludeGroups').checked;
    const personalize = document.getElementById('personalize').checked;
    const targetType = document.getElementById('targetType').value;
    const manualNumbers = document.getElementById('manualNumbers')?.value;
    const accountLevel = document.getElementById('accountLevel').value;

    // 保存当前消息模板和设置
    saveMessages();

    let messages = [];
    if (useTemplates) {
        // 收集多个消息模板
        for (let i = 1; i <= 5; i++) {
            const msg = document
                .getElementById('broadcastMessage' + i)
                ?.value?.trim();
            if (msg) {
                messages.push(msg);
            }
        }
    } else {
        // 只使用第一条
        const msg = document.getElementById('broadcastMessage1')?.value?.trim();
        if (msg) {
            messages = [msg];
        }
    }

    if (messages.length === 0) {
        alert('请输入至少一条消息内容');
        return;
    }

    const message = messages;

    const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            interval,
            randomInterval,
            randomizeMsg,
            lengthRandomize,
            simulateTyping,
            simulateMouse,
            respectHours,
            randomPause,
            excludeGroups,
            personalize,
            targetType,
            manualNumbers,
            accountLevel,
        }),
    });

    const result = await response.json();
    if (!result.success) {
        alert('启动失败: ' + result.error);
    }
}

async function stopBroadcast() {
    await fetch('/api/broadcast-stop', { method: 'POST' });
}

function updateBroadcastProgress(data) {
    const progressDiv = document.getElementById('broadcastProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const startBtn = document.getElementById('startBroadcast');
    const stopBtn = document.getElementById('stopBroadcast');
    const successFailCount = document.getElementById('successFailCount');
    const dailySentCount = document.getElementById('dailySentCount');

    if (data.running || data.current > 0) {
        progressDiv.style.display = 'block';
        startBtn.disabled = true;
        stopBtn.disabled = !data.running;

        const percent =
            data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
        progressFill.style.width = percent + '%';
        progressFill.textContent = percent + '%';

        // 显示每日配额信息
        const dailyInfo =
            data.dailySent !== undefined
                ? ` | 今日: ${data.dailySent}/${data.dailyLimit}`
                : '';
        progressText.textContent = `正在发送: ${data.current} / ${data.total}${dailyInfo}`;
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        const successCount = data.results.filter(
            (r) => r.status === 'success',
        ).length;
        const failCount = data.results.filter(
            (r) => r.status === 'failed',
        ).length;
        const dailyInfo =
            data.dailySent !== undefined
                ? ` | 今日已发: ${data.dailySent}/${data.dailyLimit}`
                : '';
        progressText.textContent = `完成！发送: ${successCount}, 失败: ${failCount}${dailyInfo}`;
    }

    // 更新活动面板的统计信息
    const successCount = data.results.filter(
        (r) => r.status === 'success',
    ).length;
    const failCount = data.results.filter((r) => r.status === 'failed').length;
    if (successFailCount) {
        successFailCount.textContent = successCount + ' / ' + failCount;
    }
    if (dailySentCount && data.dailySent !== undefined) {
        dailySentCount.textContent =
            data.dailySent + ' / ' + (data.dailyLimit || 30);
    }
}

function addMessage(data) {
    const messagesDiv = document.getElementById('receivedMessages');
    const emptyMsg = messagesDiv.querySelector('.empty-state');
    if (emptyMsg) emptyMsg.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message received';
    const time = new Date(data.timestamp * 1000).toLocaleTimeString();
    msgDiv.innerHTML = `
        <strong>${data.name || data.from}</strong>
        <span class="message-time">${time}</span>
        <br>${data.body || '[消息类型: ' + data.type + ']'}
    `;
    messagesDiv.insertBefore(msgDiv, messagesDiv.firstChild);

    if (messagesDiv.children.length > 50) {
        messagesDiv.removeChild(messagesDiv.lastChild);
    }
}

async function addAutoReply() {
    const keyword = document.getElementById('arKeyword').value;
    const reply = document.getElementById('arReply').value;
    const matchType = document.getElementById('arMatchType').value;

    if (!keyword || !reply) {
        alert('请填写关键词和回复内容');
        return;
    }

    const response = await fetch('/api/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, reply, matchType }),
    });

    const result = await response.json();
    if (result.success) {
        document.getElementById('arKeyword').value = '';
        document.getElementById('arReply').value = '';
        loadAutoReplyRules();
    } else {
        alert('添加失败: ' + result.error);
    }
}

async function loadAutoReplyRules() {
    const response = await fetch('/api/auto-reply');
    const data = await response.json();
    renderAutoReplyRules(data.rules);
}

function renderAutoReplyRules(rules) {
    const list = document.getElementById('autoReplyList');
    if (!rules || rules.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无自动回复规则</div>';
        return;
    }

    list.innerHTML = rules
        .map(
            (rule) => `
        <div class="list-item">
            <div class="list-item-content">
                <div class="list-item-title">${rule.keyword} <span class="badge badge-info">${rule.matchType}</span></div>
                <div class="list-item-subtitle">回复: ${rule.reply}</div>
            </div>
            <div>
                <button class="btn btn-sm ${rule.enabled ? 'btn-warning' : 'btn-secondary'}" onclick="toggleAutoReply(${rule.id}, ${!rule.enabled})">
                    ${rule.enabled ? '禁用' : '启用'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteAutoReply(${rule.id})">删除</button>
            </div>
        </div>
    `,
        )
        .join('');
}

async function toggleAutoReply(id, enabled) {
    await fetch(`/api/auto-reply/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
    loadAutoReplyRules();
}

async function deleteAutoReply(id) {
    await fetch(`/api/auto-reply/${id}`, { method: 'DELETE' });
    loadAutoReplyRules();
}

function toggleTaskTime() {
    const type = document.getElementById('taskType').value;
    document.getElementById('onceTimeGroup').style.display =
        type === 'once' ? 'block' : 'none';
    document.getElementById('dailyTimeGroup').style.display =
        type === 'daily' ? 'block' : 'none';
}

async function addScheduledTask() {
    const name = document.getElementById('taskName').value;
    const type = document.getElementById('taskType').value;
    const time = document.getElementById('taskTime').value;
    const dailyTime = document.getElementById('taskDailyTime').value;
    const message = document.getElementById('taskMessage').value;
    const targetType = document.getElementById('taskTarget').value;

    if (!name || !message) {
        alert('请填写任务名称和消息内容');
        return;
    }

    const taskData = {
        name,
        type,
        message,
        targetType,
    };

    if (type === 'once' && time) {
        taskData.time = time;
    } else if (type === 'daily' && dailyTime) {
        const [hour, minute] = dailyTime.split(':');
        taskData.hour = parseInt(hour);
        taskData.minute = parseInt(minute);
    }

    const response = await fetch('/api/scheduled-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
    });

    const result = await response.json();
    if (result.success) {
        alert('任务添加成功！');
        document.getElementById('taskName').value = '';
        document.getElementById('taskMessage').value = '';
        loadScheduledTasks();
    } else {
        alert('添加失败: ' + result.error);
    }
}

async function loadScheduledTasks() {
    const response = await fetch('/api/scheduled-tasks');
    const data = await response.json();
    renderScheduledTasks(data.tasks);
}

function renderScheduledTasks(tasks) {
    const list = document.getElementById('scheduledTaskList');
    if (!tasks || tasks.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无定时任务</div>';
        return;
    }

    list.innerHTML = tasks
        .map(
            (task) => `
        <div class="list-item">
            <div class="list-item-content">
                <div class="list-item-title">${task.name}</div>
                <div class="list-item-subtitle">
                    ${task.type === 'once' ? '执行时间: ' + task.time : '每天 ' + task.hour + ':' + String(task.minute).padStart(2, '0')}
                    | 发送对象: ${task.targetType}
                </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteScheduledTask(${task.id})">删除</button>
        </div>
    `,
        )
        .join('');
}

async function deleteScheduledTask(id) {
    await fetch(`/api/scheduled-tasks/${id}`, { method: 'DELETE' });
    loadScheduledTasks();
}

async function createGroup() {
    const name = document.getElementById('newGroupName').value;
    const membersText = document.getElementById('newGroupMembers').value;

    if (!name || !membersText) {
        alert('请填写群组名称和成员');
        return;
    }

    const participants = membersText
        .split('\n')
        .map((m) => m.trim())
        .filter((m) => m);

    const response = await fetch('/api/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, participants }),
    });

    const result = await response.json();
    if (result.success) {
        alert('群组创建成功！');
        document.getElementById('newGroupName').value = '';
        document.getElementById('newGroupMembers').value = '';
        loadChats();
    } else {
        alert('创建失败: ' + result.error);
    }
}

function loadGroupInfo() {
    const groupId = document.getElementById('groupSelect').value;
    document.getElementById('groupActions').style.display = groupId
        ? 'block'
        : 'none';
}

async function addGroupMembers() {
    const groupId = document.getElementById('groupSelect').value;
    const membersText = document.getElementById('addGroupMembers').value;

    if (!groupId || !membersText) {
        alert('请选择群组并输入成员');
        return;
    }

    const participants = membersText
        .split('\n')
        .map((m) => m.trim())
        .filter((m) => m);

    const response = await fetch(`/api/group/${groupId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants }),
    });

    const result = await response.json();
    if (result.success) {
        alert('成员添加成功！');
        document.getElementById('addGroupMembers').value = '';
    } else {
        alert('添加失败: ' + result.error);
    }
}

async function removeGroupMembers() {
    const groupId = document.getElementById('groupSelect').value;
    const membersText = document.getElementById('addGroupMembers').value;

    if (!groupId || !membersText) {
        alert('请选择群组并输入要移除的成员');
        return;
    }

    const participants = membersText
        .split('\n')
        .map((m) => m.trim())
        .filter((m) => m);

    const response = await fetch(`/api/group/${groupId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants }),
    });

    const result = await response.json();
    if (result.success) {
        alert('成员移除成功！');
    } else {
        alert('移除失败: ' + result.error);
    }
}

async function leaveGroup() {
    const groupId = document.getElementById('groupSelect').value;

    if (!groupId) {
        alert('请选择群组');
        return;
    }

    if (!confirm('确定要退出这个群组吗？')) return;

    const response = await fetch(`/api/group/${groupId}/leave`, {
        method: 'POST',
    });

    const result = await response.json();
    if (result.success) {
        alert('已退出群组');
        loadChats();
    } else {
        alert('退出失败: ' + result.error);
    }
}

function loadChatActions() {
    const chatId = document.getElementById('manageChatSelect').value;
    document.getElementById('chatActions').style.display = chatId
        ? 'block'
        : 'none';
}

async function markSeen() {
    const chatId = document.getElementById('manageChatSelect').value;
    if (!chatId) return;

    const response = await fetch(`/api/chat/${chatId}/mark-seen`, {
        method: 'POST',
    });
    const result = await response.json();
    alert(result.success ? '已标记已读' : '操作失败: ' + result.error);
}

async function pinChat(pin) {
    const chatId = document.getElementById('manageChatSelect').value;
    if (!chatId) return;

    const response = await fetch(`/api/chat/${chatId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
    });
    const result = await response.json();
    alert(
        result.success
            ? pin
                ? '已置顶'
                : '已取消置顶'
            : '操作失败: ' + result.error,
    );
}

async function archiveChat() {
    const chatId = document.getElementById('manageChatSelect').value;
    if (!chatId) return;

    const response = await fetch(`/api/chat/${chatId}/archive`, {
        method: 'POST',
    });
    const result = await response.json();
    alert(result.success ? '已归档' : '操作失败: ' + result.error);
}

async function muteChat() {
    const chatId = document.getElementById('manageChatSelect').value;
    if (!chatId) return;

    const response = await fetch(`/api/chat/${chatId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: 3600000 }),
    });
    const result = await response.json();
    alert(result.success ? '已开启免打扰' : '操作失败: ' + result.error);
}

async function unmuteChat() {
    const chatId = document.getElementById('manageChatSelect').value;
    if (!chatId) return;

    const response = await fetch(`/api/chat/${chatId}/unmute`, {
        method: 'POST',
    });
    const result = await response.json();
    alert(result.success ? '已取消免打扰' : '操作失败: ' + result.error);
}

let selectedFile = null;

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    selectedFile = file;
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('fileInfo').textContent =
        `已选择: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
}

async function sendMedia() {
    const chatId = document.getElementById('mediaChatSelect').value;
    const caption = document.getElementById('mediaCaption').value;

    if (!chatId || !selectedFile) {
        alert('请选择联系人和文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
        const base64 = reader.result.split(',')[1];

        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: selectedFile.name,
                base64Data: base64,
                mimeType: selectedFile.type,
            }),
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
            alert('上传失败: ' + uploadResult.error);
            return;
        }

        const sendResponse = await fetch('/api/send-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, caption }),
        });

        const sendResult = await sendResponse.json();
        if (sendResult.success) {
            alert('发送成功！');
            selectedFile = null;
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('mediaCaption').value = '';
        } else {
            alert('发送失败: ' + sendResult.error);
        }
    };
    reader.readAsDataURL(selectedFile);
}

async function lookupContact() {
    const contactId = document.getElementById('contactId').value;
    if (!contactId) {
        alert('请输入联系人 ID');
        return;
    }

    const response = await fetch(`/api/contact/${contactId}`);
    const data = await response.json();

    if (data.error) {
        alert('查询失败: ' + data.error);
        return;
    }

    const contact = data.contact;
    document.getElementById('contactInfo').style.display = 'block';
    document.getElementById('contactName').value = contact.name || '';
    document.getElementById('contactPushname').value = contact.pushname || '';
    document.getElementById('contactIsBusiness').value = contact.isBusiness
        ? '是'
        : '否';

    const picResponse = await fetch(`/api/contact/${contactId}/profile-pic`);
    const picData = await picResponse.json();
    document.getElementById('contactProfilePic').src =
        picData.profilePicUrl || '';
}

async function loadStats() {
    const response = await fetch('/api/stats');
    const data = await response.json();

    if (data.error) {
        alert('加载失败: ' + data.error);
        return;
    }

    const stats = data.stats;
    let html = `
        <div class="grid" style="margin-top: 15px;">
            <div class="card" style="text-align: center;">
                <h3 style="font-size: 2em; color: #667eea;">${stats.totalChats}</h3>
                <p>总聊天数</p>
            </div>
            <div class="card" style="text-align: center;">
                <h3 style="font-size: 2em; color: #2ed573;">${stats.privateChats}</h3>
                <p>私聊</p>
            </div>
            <div class="card" style="text-align: center;">
                <h3 style="font-size: 2em; color: #ffa502;">${stats.groupChats}</h3>
                <p>群组</p>
            </div>
        </div>
    `;

    if (stats.topGroups && stats.topGroups.length > 0) {
        html += '<h3 style="margin-top: 20px;">群组成员排行</h3>';
        html += '<div class="list-group">';
        stats.topGroups.forEach((group, index) => {
            html += `
                <div class="list-item">
                    <div class="list-item-title">${index + 1}. ${group[0]}</div>
                    <div class="badge badge-info">${group[1]} 成员</div>
                </div>
            `;
        });
        html += '</div>';
    }

    document.getElementById('statsContent').innerHTML = html;
}

async function sendLocation() {
    const chatId = document.getElementById('locationChatSelect').value;
    const lat = document.getElementById('locationLat').value;
    const lng = document.getElementById('locationLng').value;
    const title = document.getElementById('locationTitle').value;

    if (!chatId || !lat || !lng) {
        alert('请填写完整信息');
        return;
    }

    const response = await fetch('/api/send-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId,
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
            title,
        }),
    });

    const result = await response.json();
    alert(result.success ? '发送成功' : '失败: ' + result.error);
}

async function sendPoll() {
    const chatId = document.getElementById('pollChatSelect').value;
    const question = document.getElementById('pollQuestion').value;
    const optionsText = document.getElementById('pollOptions').value;
    const allowMultiple = document.getElementById('pollMultiple').checked;

    if (!chatId || !question || !optionsText) {
        alert('请填写完整信息');
        return;
    }

    const options = optionsText.split('\n').filter((o) => o.trim());

    const response = await fetch('/api/send-poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId,
            question,
            options,
            allowMultipleAnswers: allowMultiple,
        }),
    });

    const result = await response.json();
    alert(result.success ? '发送成功' : '失败: ' + result.error);
}

async function searchMessages() {
    const query = document.getElementById('searchQuery').value;
    if (!query) {
        alert('请输入搜索关键词');
        return;
    }

    const response = await fetch(
        `/api/search-messages?query=${encodeURIComponent(query)}`,
    );
    const data = await response.json();

    if (data.error) {
        alert('搜索失败: ' + data.error);
        return;
    }

    const results = data.results;
    if (results.length === 0) {
        document.getElementById('searchResults').innerHTML =
            '<div class="empty-state">未找到结果</div>';
        return;
    }

    let html = '<div class="list-group">';
    results.forEach((r) => {
        const time = new Date(r.timestamp * 1000).toLocaleString();
        html += `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${r.chatName}</div>
                    <div class="list-item-subtitle">${r.body}</div>
                    <div class="message-time">${time}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    document.getElementById('searchResults').innerHTML = html;
}

async function loadChannels() {
    const response = await fetch('/api/channel/list');
    const data = await response.json();

    if (data.channels && data.channels.length > 0) {
        let html = '<div class="list-group">';
        data.channels.forEach((c) => {
            html += `
                <div class="list-item">
                    <div class="list-item-title">${c.name}</div>
                    <div class="list-item-subtitle">${c.description || ''}</div>
                </div>
            `;
        });
        html += '</div>';
        document.getElementById('channelList').innerHTML = html;
    } else {
        document.getElementById('channelList').innerHTML =
            '<div class="empty-state">暂无频道</div>';
    }
}

async function createChannel() {
    const name = document.getElementById('channelName').value;
    const description = document.getElementById('channelDesc').value;

    if (!name) {
        alert('请输入频道名称');
        return;
    }

    const response = await fetch('/api/channel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
    });

    const result = await response.json();
    if (result.success) {
        alert('创建成功');
        document.getElementById('channelName').value = '';
        document.getElementById('channelDesc').value = '';
        loadChannels();
    } else {
        alert('失败: ' + result.error);
    }
}

async function joinGroup() {
    const link = document.getElementById('joinLink').value;
    if (!link) {
        alert('请输入邀请链接');
        return;
    }

    const inviteCode = link.match(/chat\/([a-zA-Z0-9-]+)/)?.[1] || link;

    const response = await fetch('/api/join-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
    });

    const result = await response.json();
    alert(result.success ? '加入成功' : '失败: ' + result.error);
}

async function updateProfileName() {
    const name = document.getElementById('newProfileName').value;
    if (!name) {
        alert('请输入新昵称');
        return;
    }

    const response = await fetch('/api/profile/update-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });

    const result = await response.json();
    alert(result.success ? '修改成功' : '失败: ' + result.error);
}

async function updateProfileStatus() {
    const status = document.getElementById('newProfileStatus').value;
    if (!status) {
        alert('请输入新状态');
        return;
    }

    const response = await fetch('/api/profile/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });

    const result = await response.json();
    alert(result.success ? '修改成功' : '失败: ' + result.error);
}

async function sendSticker() {
    const chatId = document.getElementById('stickerChatSelect').value;
    const url = document.getElementById('stickerUrl').value;

    if (!chatId || !url) {
        alert('请填写完整信息');
        return;
    }

    const response = await fetch('/api/send-sticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, url }),
    });

    const result = await response.json();
    alert(result.success ? '发送成功' : '失败: ' + result.error);
}

async function loadLabels() {
    const response = await fetch('/api/labels');
    const data = await response.json();

    const labelList = document.getElementById('labelList');
    const labelSelect = document.getElementById('labelSelect');

    if (data.labels && data.labels.length > 0) {
        let html = '<div class="list-group">';
        data.labels.forEach((l) => {
            html += `
                <div class="list-item">
                    <div class="list-item-title" style="color: #${l.color || '667eea'}">● ${l.name}</div>
                </div>
            `;
        });
        html += '</div>';
        labelList.innerHTML = html;

        labelSelect.innerHTML = '<option value="">-- 选择标签 --</option>';
        data.labels.forEach((l) => {
            const option = document.createElement('option');
            option.value = l.id;
            option.textContent = l.name;
            labelSelect.appendChild(option);
        });
    } else {
        labelList.innerHTML = '<div class="empty-state">暂无标签</div>';
    }
}

async function addLabelToChat() {
    const chatId = document.getElementById('labelChatSelect').value;
    const labelId = document.getElementById('labelSelect').value;

    if (!chatId || !labelId) {
        alert('请选择聊天和标签');
        return;
    }

    const response = await fetch(`/api/chat/${chatId}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId, action: 'add' }),
    });

    const result = await response.json();
    alert(result.success ? '添加成功' : '失败: ' + result.error);
}

async function removeLabelFromChat() {
    const chatId = document.getElementById('labelChatSelect').value;

    if (!chatId) {
        alert('请选择聊天');
        return;
    }

    const response = await fetch(`/api/chat/${chatId}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelId: null, action: 'remove' }),
    });

    const result = await response.json();
    alert(result.success ? '移除成功' : '失败: ' + result.error);
}

// 初始化
loadAutoReplyRules();
loadScheduledTasks();
loadChats();
