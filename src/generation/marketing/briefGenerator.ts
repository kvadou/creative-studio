import type { MarketingScript, UGCCreator } from '@prisma/client';

export function generateBriefHtml(
  script: MarketingScript,
  creator: UGCCreator | null
): string {
  const formatLabel: Record<string, string> = {
    HOOK_PROBLEM_PROOF_CTA: 'Hook / Problem / Proof / CTA',
    BEFORE_AFTER: 'Before / After',
    STORY_ARC: 'Story Arc',
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 32px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-top: 32px; margin-bottom: 8px; border-top: 1px solid #eee; padding-top: 16px; }
    .script-block { background: #f8f8f8; border-left: 3px solid #222; padding: 16px 20px; margin: 12px 0; border-radius: 0 4px 4px 0; }
    .hook { border-left-color: #e84c3d; font-size: 18px; font-weight: bold; }
    .tip { background: #fffbea; border: 1px solid #ffe066; border-radius: 4px; padding: 12px 16px; margin: 12px 0; font-size: 14px; }
    .hashtags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .hashtag { background: #222; color: white; padding: 4px 10px; border-radius: 20px; font-size: 13px; }
    .pay { background: #e8f5e9; border: 1px solid #81c784; border-radius: 4px; padding: 12px 16px; font-size: 14px; }
    .footer { margin-top: 40px; font-size: 12px; color: #aaa; }
  </style>
</head>
<body>

<h1>Acme Creative — UGC Creator Brief</h1>
<p class="meta">
  ${creator ? `For: <strong>${creator.name}</strong> (@${creator.tiktokHandle})` : 'Creator: TBD'} &nbsp;|&nbsp;
  Format: ${formatLabel[script.format] || script.format} &nbsp;|&nbsp;
  Target length: ~${script.durationTarget} seconds
</p>

<h2>Your Script</h2>

<p style="font-size:13px;color:#666;margin-bottom:4px;">Start with this exact hook — don't add an intro first:</p>
<div class="script-block hook">"${script.hook}"</div>

<p style="font-size:13px;color:#666;margin-bottom:4px;">Continue with:</p>
<div class="script-block">${script.body.replace(/\n/g, '<br>')}</div>

<p style="font-size:13px;color:#666;margin-bottom:4px;">Close with:</p>
<div class="script-block">"${script.cta}"</div>

<h2>Text Overlay</h2>
<div class="tip">📝 <strong>First 3 seconds:</strong> ${script.textOverlaySuggestion || 'Add bold text on screen that reinforces your hook'}</div>

<h2>Filming Direction</h2>

${script.settingSuggestion ? `<div class="tip">📍 <strong>Setting:</strong> ${script.settingSuggestion}</div>` : ''}
${script.propsSuggestion ? `<div class="tip">🎬 <strong>Props/Visuals:</strong> ${script.propsSuggestion}</div>` : ''}
${script.toneSuggestion ? `<div class="tip">🎙️ <strong>Tone & Energy:</strong> ${script.toneSuggestion}</div>` : ''}

<div class="tip">📱 <strong>Format:</strong> Vertical video (9:16). No filters needed. Natural light preferred. Ring light OK.</div>
<div class="tip">✂️ <strong>Edit:</strong> No cuts needed for shorter formats. Keep it one take if possible — feels more real.</div>

<h2>Content Guidelines</h2>
<div class="tip">👤 <strong>On Camera:</strong> Film YOURSELF talking to camera. You may show chess boards, homework, your kitchen table — but check with us before including children on camera. We need signed parental consent for any minors shown.</div>
<div class="tip">🗣️ <strong>Audience:</strong> Speak parent-to-parent. Never address children directly in the video.</div>

<h2>Hashtags to Include</h2>
<div class="hashtags">
  ${script.hashtags.map(h => `<span class="hashtag">#${h.replace(/^#/, '')}</span>`).join('')}
  <span class="hashtag">#acmecreative</span>
</div>

<h2>Important Notes</h2>
<div class="tip">🔗 Include <strong>acmecreative.com</strong> in your bio or caption. We'll send you the exact link to use.</div>
<div class="tip">📤 Send us the raw video file (not just the TikTok link) via email or Google Drive link before posting so we can review.</div>
<div class="tip">✅ You can use this script as written OR adapt it naturally — just keep the core message and the hook.</div>

<h2>Usage Rights</h2>
<div class="tip">📋 By submitting this video, you grant Acme Creative the right to:
<br>• Post on Acme Creative's TikTok, Instagram, Facebook, and YouTube accounts
<br>• Use in paid advertising campaigns across all platforms
<br>• Feature on acmecreative.com and in email marketing
<br>• Edit for length or format as needed
<br>You retain the right to post on your own accounts.</div>

<h2>Payment</h2>
<div class="pay">
  💰 Rate: <strong>$${creator?.ratePerVideo?.toFixed(2) || '17.50'} per approved video</strong><br>
  Paid within 3 days of video going live via Venmo/PayPal.
  ${creator?.promoCode ? `<br>🏷️ Share promo code <strong>${creator.promoCode}</strong> with your audience.` : ''}
</div>

<h2>Questions?</h2>
<p>Email <a href="mailto:doug.kvamme@acmecreative.com">doug.kvamme@acmecreative.com</a></p>

<p class="footer">Acme Creative · acmecreative.com · Brief generated ${new Date().toLocaleDateString()}</p>

</body>
</html>
`;
}
