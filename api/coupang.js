export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { keyword, limit = 30, debug = false } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: "keyword is required" });
  }

  const searchUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(keyword)}&channel=user`;

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.coupang.com/",
        "Cache-Control": "no-cache"
      }
    });

    const html = await response.text();

    const debugInfo = {
      status: response.status,
      htmlLength: html.length,
      hasSearchProduct: html.includes("search-product"),
      hasPriceValue: html.includes("price-value"),
      hasRatingCount: html.includes("rating-total-count"),
      hasRobotOrCaptcha:
        html.toLowerCase().includes("captcha") ||
        html.toLowerCase().includes("robot") ||
        html.includes("Access Denied") ||
        html.includes("차단")
    };

    const items = [];

    const blockRegex = /<li[^>]*class="[^"]*search-product[^"]*"[\s\S]*?<\/li>/g;
    const productBlocks = html.match(blockRegex) || [];

    for (const block of productBlocks.slice(0, limit)) {
      const titleMatch =
        block.match(/<div[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
        block.match(/<span[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/span>/);

      const priceMatch =
        block.match(/<strong[^>]*class="[^"]*price-value[^"]*"[^>]*>([\s\S]*?)<\/strong>/) ||
        block.match(/<span[^>]*class="[^"]*price-value[^"]*"[^>]*>([\s\S]*?)<\/span>/);

      const reviewMatch =
        block.match(/<span[^>]*class="[^"]*rating-total-count[^"]*"[^>]*>\(?([\d,]+)\)?<\/span>/) ||
        block.match(/리뷰\s*([\d,]+)/);

      const urlMatch =
        block.match(/<a[^>]*href="([^"]+)"/);

      const clean = (s) =>
        s
          ? s.replace(/<script[\s\S]*?<\/script>/g, "")
              .replace(/<style[\s\S]*?<\/style>/g, "")
              .replace(/<[^>]+>/g, "")
              .replace(/\s+/g, " ")
              .trim()
          : "";

      const title = clean(titleMatch?.[1]);
      const price = priceMatch ? Number(clean(priceMatch[1]).replace(/[^\d]/g, "")) : null;
      const reviewCount = reviewMatch ? Number(reviewMatch[1].replace(/,/g, "")) : 0;

      let deliveryType = "판매자배송";

      if (block.includes("판매자로켓") || block.includes("seller-rocket")) {
        deliveryType = "판매자로켓";
      } else if (block.includes("로켓배송") || block.includes("rocket")) {
        deliveryType = "로켓배송";
      }

      const productUrl = urlMatch
        ? `https://www.coupang.com${urlMatch[1].replace(/&amp;/g, "&")}`
        : null;

      if (title) {
        items.push({
          rank: items.length + 1,
          title,
          price,
          reviewCount,
          deliveryType,
          productUrl
        });
      }
    }

    const total = items.length || 1;
    const rocketCount = items.filter((x) => x.deliveryType === "로켓배송").length;
    const sellerRocketCount = items.filter((x) => x.deliveryType === "판매자로켓").length;
    const sellerDeliveryCount = items.filter((x) => x.deliveryType === "판매자배송").length;

    const prices = items.map((x) => x.price).filter((x) => Number.isFinite(x));
    const reviews = items.map((x) => x.reviewCount).filter((x) => Number.isFinite(x));

    const average = (arr) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return res.status(200).json({
      keyword,
      limit,
      source: "Coupang search result page",
      warning: "쿠팡 페이지 구조나 차단 정책에 따라 일부 데이터가 누락될 수 있음",
      summary: {
        productCount: items.length,
        rocketRatio: Math.round((rocketCount / total) * 100),
        sellerRocketRatio: Math.round((sellerRocketCount / total) * 100),
        sellerDeliveryRatio: Math.round((sellerDeliveryCount / total) * 100),
        averagePrice: average(prices),
        averageReviewCount: average(reviews)
      },
      items,
      debug: debug ? debugInfo : undefined
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Coupang data",
      detail: error.message
    });
  }
}
