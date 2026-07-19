// ============================================================
//  AUTO CONTENT GENERATOR — pulls from RSS, optionally rewrites
//  Cost: $0 (uses free public RSS feeds + optional free Gemini)
// ============================================================

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser();

// 👇 EDIT THIS LIST to promote WHATEVER you want
// Examples: deal sites, product launches, your blog, affiliate feeds, niche news
const FEEDS = [
  { url: 'https://www.dealnews.com/c142/Electronics/?rss=1', tag: 'Deals' },
  { url: 'https://slickdeals.net/newsearch.php?mode=frontpage&rss=1', tag: 'Deals' },
  { url: 'https://www.producthunt.com/feed', tag: 'Products' },
  { url: 'https://www.theverge.com/rss/index.xml', tag: 'Tech' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', tag: 'Business' },
  // 👇 Add YOUR own affiliate links, niche blogs, YouTube channels, etc.
  // { url: 'YOUR_RSS_FEED_URL', tag: 'YourTag' },
];

const MAX_POSTS_PER_RUN = 5;
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

async function maybeRewrite(title, summary) {
  // Optional: use FREE Google Gemini API to rewrite for SEO
  // Skip if no API key set (still works with raw RSS content)
  if (!process.env.GEMINI_API_KEY) {
    return { title, summary };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Rewrite this for a promotional blog. Make it punchy and engaging. Return JSON with "title" and "summary" only.\n\nOriginal title: ${title}\nOriginal summary: ${summary}`
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
      return {
        title: parsed.title || title,
        summary: parsed.summary || summary
      };
    }
  } catch (e) {
    console.error('Gemini rewrite failed (using original):', e.message);
  }
  return { title, summary };
}

function makePostHtml(post) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)}</title>
<meta name="description" content="${escapeHtml(post.summary)}">
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #0f172a; color: #e2e8f0; line-height: 1.7; }
  h1 { color: #f1f5f9; border-bottom: 2px solid #6366f1; padding-bottom: 15px; }
  .meta { color: #94a3b8; font-size: 0.9rem; margin: 20px 0; }
  .tag { display: inline-block; background: #6366f1; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-right: 6px; }
  .summary { background: #1e293b; padding: 20px; border-left: 4px solid #6366f1; border-radius: 8px; margin: 25px 0; }
  a.back { color: #818cf8; text-decoration: none; display: inline-block; margin-top: 30px; }
  .cta { display: inline-block; background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; margin: 20px 0; font-weight: 600; }
</style>
</head>
<body>
  <h1>${escapeHtml(post.title)}</h1>
  <p class="meta">📅 ${new Date(post.date).toLocaleString()} • ${post.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</p>
  <div class="summary">${escapeHtml(post.summary)}</div>
  <p>👉 <a class="cta" href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="nofollow noopener">Learn more →</a></p>
  <p style="color:#64748b; font-size:0.85rem; margin-top:30px;">Source: <a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="nofollow noopener" style="color:#818cf8;">${escapeHtml(post.sourceName)}</a></p>
  <a class="back" href="../">← Back to all posts</a>
</body>
</html>`;
}

(async () => {
  console.log('🚀 Starting auto-publish run...');

  // Load history
  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch {}
  }

  // Load existing articles
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
        if (history.includes(item.link)) continue;  // skip duplicates

        const { title, summary } = await maybeRewrite(
          item.title,
          (item.contentSnippet || item.content || item.summary || '').slice(0, 300)
        );

        const slug = slugify(title) + '-' + Date.now().toString(36);
        const post = {
          slug,
          title,
          summary: summary || item.contentSnippet || '',
          sourceUrl: item.link,
          sourceName: data.title || feed.tag,
          date: new Date().toISOString(),
          tags: [feed.tag, 'auto']
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

  // Keep history manageable
  history = history.slice(-500);

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articlesData, null, 2));
  console.log(`🎉 Done. ${newCount} new post(s) published.`);
})();
