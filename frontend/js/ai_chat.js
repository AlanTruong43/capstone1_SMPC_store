// frontend/js/ai_chat.js

const chatBox   = document.getElementById('chat');
const form      = document.getElementById('composer');
const input     = document.getElementById('user-input');

function appendBubble(role, message) {
  const row = document.createElement('div');
  row.className = 'row ' + (role === 'user' ? 'user' : 'bot');

  const b = document.createElement('div');
  b.className = 'bubble ' + (role === 'user' ? 'user' : 'bot');
  b.textContent = message;

  row.appendChild(b);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendQuery(q) {
  // q là chuỗi đã lấy từ input
  appendBubble('user', q);

  try {
    const res = await fetch('/ai/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('AI error:', t);
      appendBubble('bot', 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu.');
      return;
    }

    const data = await res.json();
    // data dạng { reply: "...", items: [...] }
    if (data.reply) appendBubble('bot', data.reply);

    if (Array.isArray(data.items) && data.items.length) {
      // Tóm tắt ngắn danh sách gợi ý
      const tops = data.items.slice(0, 5)
        .map(p => `• ${p.name} – ${Number(p.price).toLocaleString('vi-VN')} VND`)
        .join('\n');
      appendBubble('bot', `Gợi ý:\n${tops}`);
    }
  } catch (err) {
    console.error(err);
    appendBubble('bot', 'Xin lỗi, đã xảy ra lỗi khi xử lý yêu cầu.');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = (input.value || '').trim();
  if (!q) return;
  input.value = '';
  sendQuery(q); // <-- dùng q, KHÔNG có biến 'text' nào ở đây
});
