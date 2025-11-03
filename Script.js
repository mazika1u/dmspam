const emojis = '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪🤨🧐🤓😎🥸🤠🤡🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑🫡🫢🫣🤤😪😴😵😵‍💫😲😯😬🙄😮‍💨😷🤒🤕🤢🤮🤧😇🥹🤑🤠😈👿👹👺💀☠️👻👽🤖🎃😺😸😹😻😼😽🙀😿😾';
const emojiArray = Array.from(emojis);

let show_all_logs = false;
let run_spam_dm = false;
let leave_group = false;
let stop_spam = false;

// イベントリスナーの設定
document.getElementById('stopBtn').addEventListener('click', () => {
    stop_spam = true;
    log('🛑 スパムが停止されました');
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.textContent = '実行';
});

document.getElementById('image').addEventListener('change', event => {
    const fileName = event.target.files[0]?.name || '未選択';
    document.getElementById('fileName').textContent = fileName;
});

document.getElementById('showLogsCheckbox').addEventListener('change', event => {
    show_all_logs = event.target.checked;
});

document.getElementById('spamDmCheckbox').addEventListener('change', event => {
    run_spam_dm = event.target.checked;
});

document.getElementById('leaveDMCheckbox').addEventListener('change', event => {
    leave_group = event.target.checked;
});

document.getElementById('form').addEventListener('submit', async event => {
    event.preventDefault();
    stop_spam = false;
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = '実行中...';

    const token = document.getElementById('token').value;
    const message = '# おぜうの集い万歳\n## 今すぐ参加しよう\ndiscord.gg/acvr\nozetudo.net\nozeu.site';
    const imageFile = document.getElementById('image').files[0];
    const userIdsInput = document.getElementById('userIds').value.trim();
    const userIds = userIdsInput ? userIdsInput.split(/[\s,]+/).map(id => id.trim()).filter(id => id) : null;

    let imageBase64 = null;
    if (imageFile) {
        imageBase64 = await to_base64(imageFile);
    }

    const isValidToken = await is_token_valid(token);
    if (!isValidToken) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = 'トークン無効';
        setTimeout(() => {
            submitBtn.textContent = '実行';
        }, 2000);
        return;
    }

    try {
        log('🚀 実行開始...');
        await Promise.all([
            create_group(token, message, imageBase64, userIds),
            run_spam_dm ? spam_dm(token, message, userIds) : null
        ].filter(Boolean));
    } catch (error) {
        log('❌ エラー: ' + error.message);
    }

    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.textContent = '✅ 終了';
    setTimeout(() => {
        submitBtn.textContent = '実行';
    }, 2000);
});

async function send_message(token, message, channelId) {
    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
    };
    
    const body = {
        'mobile_network_type': 'wifi',
        'content': message,
        'tts': false,
        'flags': 0,
        'signal_strength': 0
    };
    
    const response = await fetch('https://discord.com/api/v9/channels/' + channelId + '/messages', {
        'method': 'POST',
        'headers': headers,
        'body': JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (show_all_logs) log(JSON.stringify(result));
    
    if (response.status < 300) {
        log('✅ メッセージ送信成功');
        return;
    }
    
    if (response.status === 429) {
        log('⏳ メッセージ送信レート制限: ' + result.retry_after + '秒待機...');
        await new Promise(resolve => setTimeout(resolve, result.retry_after * 1000));
        return send_message(token, message, channelId);
    }
}

async function create_group(token, message, imageBase64, userIds = null) {
    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
    };
    
    let friendsResponse = await fetch('https://discord.com/api/v9/users/@me/relationships', {
        'headers': {'Authorization': token}
    });
    
    if (friendsResponse.status === 429) {
        const rateLimit = await friendsResponse.json();
        const waitTime = rateLimit.retry_after * 1000;
        log('⏳ フレンド取得レート制限: ' + rateLimit.retry_after + '秒待機...');
        await sleep(waitTime);
        if (stop_spam) return;
        friendsResponse = await fetch('https://discord.com/api/v9/users/@me/relationships', {
            'headers': {'Authorization': token}
        });
    }
    
    const friends = await friendsResponse.json();
    if (show_all_logs) log(JSON.stringify(friends));
    
    let recipientIds;
    if (userIds) {
        recipientIds = friends.filter(friend => friend.type === 1 && userIds.includes(friend.id))
                            .map(friend => friend.id)
                            .slice(0, 9);
    } else {
        recipientIds = friends.filter(friend => friend.type === 1)
                            .map(friend => friend.id)
                            .slice(0, 9);
    }
    
    if (recipientIds.length === 0) {
        log('❌ 指定されたユーザーはフレンドではありません。');
        return;
    }
    
    let successCount = 0;
    do {
        if (stop_spam) return;
        
        const groupName = 'spam-by-ozeu-' + getRandomEmojis(10) + ' https://discord.gg/ozetudo';
        
        try {
            let createResponse = await fetch('https://discord.com/api/v9/users/@me/channels', {
                'method': 'POST',
                'headers': headers,
                'body': JSON.stringify({'recipients': recipientIds})
            });
            
            if (createResponse.status === 429) {
                const rateLimit = await createResponse.json();
                const waitTime = rateLimit.retry_after * 1000;
                log('⏳ グループ作成レート制限: ' + rateLimit.retry_after + '秒待機...');
                await new Promise(resolve => setTimeout(resolve, waitTime));
                if (stop_spam) return;
                continue;
            }
            
            if (createResponse.status === 400) {
                log('❌ グループ作成失敗(400)：フレンドリストを再取得します');
                const friendsResponse2 = await fetch('https://discord.com/api/v9/users/@me/relationships', {
                    'headers': {'Authorization': token}
                });
                const friends2 = await friendsResponse2.json();
                const allFriendIds = friends2.filter(friend => friend.type === 1)
                                           .map(friend => friend.id);
                
                if (userIds) {
                    recipientIds = allFriendIds.filter(id => userIds.includes(id))
                                             .slice(0, 9);
                } else {
                    recipientIds = allFriendIds.slice(0, 9);
                }
                
                if (recipientIds.length === 0) {
                    log('❌ 対象ユーザーがいなくなったため、処理を中断します');
                    return;
                }
                
                document.getElementById('userIds').value = recipientIds.join(',');
                continue;
            }
            
            const groupData = await createResponse.json();
            if (show_all_logs) log(JSON.stringify(groupData));
            
            const groupId = groupData.id;
            const editData = {'name': groupName};
            if (imageBase64) editData['icon'] = imageBase64;
            
            const editResponse = await fetch('https://discord.com/api/v9/channels/' + groupId, {
                'method': 'PATCH',
                'headers': headers,
                'body': JSON.stringify(editData)
            });
            
            if (editResponse.status < 300) {
                successCount++;
                log('✅ グループ作成成功 (' + successCount + ' 個目)');
            }
            
            if (editResponse.status === 429) {
                const rateLimit = await editResponse.json();
                const waitTime = rateLimit.retry_after * 1000;
                log('⏳ グループ編集レート制限: ' + rateLimit.retry_after + '秒待機...');
                await new Promise(resolve => setTimeout(resolve, waitTime));
                if (stop_spam) return;
                continue;
            }
            
            await send_message(token, message, groupId);
            if (leave_group) await leave_group_dm(token, groupId);
            
        } catch (error) {
            log('❌ グループ作成エラー: ' + error.message);
        }
    } while (!stop_spam);
}

async function spam_dm(token, message, userIds = null) {
    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
    };
    
    let channelsResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
        'headers': headers
    });
    
    if (channelsResponse.status === 429) {
        const rateLimit = await channelsResponse.json();
        const waitTime = rateLimit.retry_after * 1000;
        log('⏳ DMリスト取得レート制限: ' + rateLimit.retry_after + '秒待機...');
        await new Promise(resolve => setTimeout(resolve, waitTime));
        channelsResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
            'headers': headers
        });
    }
    
    const channels = await channelsResponse.json();
    if (show_all_logs) log(JSON.stringify(channels));
    
    const dmChannels = channels.filter(channel => {
        const recipient = channel.recipients?.[0];
        return recipient && (!userIds || userIds.includes(recipient.id));
    });
    
    do {
        for (const channel of dmChannels) {
            if (stop_spam) return;
            try {
                await send_message(token, message, channel.id);
            } catch (error) {
                log('❌ メッセージ送信エラー: ' + error.message);
            }
        }
    } while (!stop_spam);
}

async function leave_group_dm(token, channelId) {
    const headers = {
        'Authorization': token,
        'Content-Type': 'application/json'
    };
    
    try {
        const response = await fetch('https://discord.com/api/v9/channels/' + channelId + '?silent=false', {
            'method': 'DELETE',
            'headers': headers
        });
        
        if (response.status < 300) {
            log('✅ グループ ' + channelId + ' を正常に退出しました。');
        } else {
            if (response.status === 429) {
                const rateLimit = await response.json();
                const waitTime = rateLimit.retry_after || 1;
                log('⏳ グループ退出レート制限：' + rateLimit.retry_after + '秒待機...');
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                return leave_group_dm(token, channelId);
            } else {
                const text = await response.text();
                log('❌ 退出失敗: ' + response.status + ' - ' + text);
            }
        }
    } catch (error) {
        log('❌ エラー: ' + error.message);
    }
}

async function is_token_valid(token) {
    const response = await fetch('https://discord.com/api/v9/users/@me', {
        'headers': {'Authorization': token}
    });
    
    if (response.status < 300) {
        const userData = await response.json();
        log('✅ トークン有効：' + userData.username);
        return true;
    } else {
        log('❌ トークン無効:（status ' + response.status + '）');
        return false;
    }
}

function to_base64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function log(message) {
    const statusElement = document.getElementById('status');
    statusElement.textContent += '\n' + new Date().toLocaleTimeString() + ' - ' + message;
    statusElement.scrollTop = statusElement.scrollHeight;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomEmojis(count) {
    let result = '';
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * emojiArray.length);
        result += emojiArray[randomIndex];
    }
    return result;
}
