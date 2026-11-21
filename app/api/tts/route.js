/**
 * @file app/api/tts/route.js
 * Zero-cost, high-fidelity neural Text-to-Speech audio streaming endpoint.
 * Fetches realistic, natural human voice in English (en-IN) and Hindi (hi).
 */

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const lang = searchParams.get('lang') || 'en-IN';

  if (!text || !text.trim()) {
    return new Response(JSON.stringify({ error: 'Text parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Sanitize text and cap chunk length at 500 characters
  const cleanText = text.trim().slice(0, 500);
  const ttsLang = lang.toLowerCase().startsWith('hi') ? 'hi' : 'en-IN';

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${ttsLang}&client=tw-ob`;

  try {
    const upstreamRes = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ error: 'TTS upstream provider error' }), {
        status: upstreamRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const audioBuffer = await upstreamRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to stream TTS audio: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
