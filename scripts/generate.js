// ============================================================
//  AUTO CONTENT GENERATOR
//  - Pulls from RSS feeds (free, unlimited)
//  - Optional AI rewriting via free Gemini
//  - Auto-detects & tags affiliate-friendly content
//  - Cost: $0 forever
// ============================================================

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const parser = new Parser();

// 👇👇👇 EDIT THIS LIST TO PROMOTE WHATEVER YOU WANT 👇👇👇
// Mix & match — drop in any RSS feed URL.
const FEEDS = [
  // === DEALS (high affiliate potential) ===
  { url: 'https://www.dealnews.com/c142/Electronics/?rss=1', tag: 'Deals', emoji: '💰' },
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&rss=1', tag: 'Deals', emoji: '💰' },
  
  // === PRODUCT LAUNCHES ===
  { url: 'https://www.producthunt.com/feed', tag: 'Products', emoji: '🎁' },
  
  // === TECH NEWS ===
  { url: 'https://www.theverge.com/rss/index.xml', tag: 'Tech', emoji: '⚡' },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', tag: 'Tech', emoji: '⚡' },
  
  // === AI TOOLS (very promotable) ===
  // Add your own niche feeds here:
  // { url: 'YOUR_AFFILIATE_FEED_URL', tag: 'Tools', emoji: '🛠️' },
];

const MAX_POSTS_PER_RUN = 6;
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'published-history.json');
const ARTICLES_FILE = path.join(__dirname, '..', 'data', 'articles.json');
const POSTS_DIR = path.join(__dirname, '..', 'posts');

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'post-' + Date.now();
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function detectAffiliatePotential(item, tag) {
  // Auto-tag high-value commercial content for affiliate placement
  const commercialTags = ['Deals', 'Products'];
  return commercialTags.includes(tag);
}

async function maybeRewrite(title, summary) {
  if (!process.env.GEMINI_API_KEY) return { title, summary };
  
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Rewrite this for a promotional blog post. Make it engaging and clickable. Return JSON only with "title" and "summary" fields. Keep it under 200 chars for summary.\n\nOriginal: ${title}\nDetails: ${summary}`
            }]
          }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return { title: parsed.title || title, summary: parsed.summary || summary };
    }
  } catch (e) {
    console.error('AI rewrite failed (using original):', e.message);
  }
  return { title, summary };
}

function makePostHtml(post) {
  const isExternal = post.sourceUrl && !post.sourceUrl.includes('github.io');
  const ctaText = isExternal ? '🎯 Get This Deal' : 'Read More';
  const ctaUrl = isExternal ? post.sourceUrl : '#';
  const targetAttr = isExternal ? 'target="_blank" rel="nofollow noopener sponsored"' : '';
  const affiliateNote = post.affiliateEligible ? 
    '<p style="background:#1e293b;border-left:3px solid #f59e0b;padding:10px 15px;border-radius:6px;color:#fbbf24;font-size:.85rem;margin:20px 0">💡 <strong>Affiliate disclosure:</strong> We may earn a commission if you purchase through this link — at no extra cost to you.</p>' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)}</title>
<meta name="description" content="${escapeHtml(post.summary.slice(0, 160))}">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.summary.slice(0, 160))}">
<style>
body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#0f172a;color:#e2e8f0;line-height:1.7}
h1{color:#f1f5f9;border-bottom:2px solid #6366f1;padding-bottom:15px;margin-bottom:20px}
.meta{color:#94a3b8;font-size:.9rem;margin:15px 0}
.tag{display:inline-block;background:rgba(99,102,241,.15);color:#a5b4fc;padding:4px 12px;border-radius:20px;font-size:.8rem;margin-right:6px}
.summary{background:#1e293b;padding:25px;border-left:4px solid #6366f1;border-radius:8px;margin:25px 0;font-size:1.05rem;color:#e2e8f0}
.cta{display:inline-block;background:linear-gradient(135deg,#6366f1,#ec4899);color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;margin:20px 0;font-weight:700;font-size:1.1rem;transition:transform .15s}
.cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(99,102,241,.4)}
a.back,a.source{color:#818cf8;text-decoration:none}
a.back{display:inline-block;margin-top:40px}
.email-cta{background:linear-gradient(135deg,#6366f1,#ec4899);padding:30px;border-radius:12px;text-align:center;margin:40px 0;color:#fff}
.email-cta a{background:#fff;color:#6366f1;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;margin-top:10px}
.source-box{margin-top:40px;padding-top:20px;border-top:1px solid #334155;color:#64748b;font-size:.85rem}
</style>
</head>
<body>
<h1>${escapeHtml(post.title)}</h1>
<p class="meta">📅 ${new Date(post.date).toLocaleString()} • ${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</p>

<div class="summary">${escapeHtml(post.summary)}</div>

${affiliateNote}

<a href="${escapeHtml(ctaUrl)}" class="cta" ${targetAttr}>${ctaText} →</a>

<!-- IN-PAGE EMAIL CAPTURE -->
<div class="email-cta">
  <h3 style="margin-bottom:8px">📬 Want more picks like this?</h3>
  <p style="opacity:.95">Get the best of the best, weekly. Free forever.</p>
  <a href="../#email">Subscribe Free →</a>
</div>

<div class="source-box">
  <p>Source: <a class="source" href="${escapeHtml(post.sourceUrl)}" ${targetAttr}>${escapeHtml(post.sourceName)}</a></p>
</div>

<a class="back" href="../">← Back to all picks</a>
</body>
</html>`;
}

(async () => {
  console.log('🚀 Starting auto-publish run...');

  // Load state
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch {}
  }
  let articlesData = { articles: [] };
  if (fs.existsSync(ARTICLES_FILE)) {
    try { articlesData = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf8')); } catch {}
  }

  // Ensure dirs
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  if (!fs.existsSync(path.dirname(ARTICLES_FILE))) fs.mkdirSync(path.dirname(ARTICLES_FILE), { recursive: true });

  let newCount = 0;

  for (const feed of FEEDS) {
    if (newCount >= MAX_POSTS_PER_RUN) break;
    try {
      console.log(`📡 Fetching: ${feed.url}`);
      const data = await parser.parseURL(feed.url);
      const items = data.items.slice(0, 3);

      for (const item of items) {
        if (newCount >= MAX_POSTS_PER_RUN) break;
        if (!item.title || !item.link) continue;
        if (history.includes(item.link)) continue;

        const { title, summary } = await maybeRewrite(
          item.title,
          (item.contentSnippet || item.content || item.summary || '').slice(0, 400)
        );

        const slug = slugify(title) + '-' + Date.now().toString(36);
        const post = {
          slug,
          title,
          summary: summary || item.contentSnippet || '',
          sourceUrl: item.link,
          sourceName: data.title || feed.tag,
          date: new Date().toISOString(),
          tags: [feed.tag, 'auto'],
          emoji: feed.emoji || '✨',
          affiliateEligible: detectAffiliatePotential(item, feed.tag)
        };

        fs.writeFileSync(path.join(POSTS_DIR, `${slug}.html`), makePostHtml(post));
        articlesData.articles.unshift(post);
        history.push(item.link);
        newCount++;
        console.log(`✅ Published: ${title}`);
      }
    } catch (err) {
      console.error(`❌ Feed error (${feed.url}):`, err.message);
    }
  }

  // Trim history to keep file small
  history = history.slice(-500);

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articlesData, null, 2));
  console.log(`🎉 Done. ${newCount} new post(s) published. Total: ${articlesData.articles.length}`);
})();
