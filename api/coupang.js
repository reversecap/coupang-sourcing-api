export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { keyword, limit = 30 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: "keyword is required" });
  }

  const searchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    const html = await response.text();

    const items = [];
    const productBlocks = html.split('search-product').slice(1, limit + 1);

    for (let i = 0; i < productBlocks.length; i++) {
      const block = productBlocks[i];

      const titleMatch = block.match(/<div class="name">([\s\S]*?)<\/div>/);
      const priceMatch = block.match(/<strong class="price-value">([\s\S]*?)<\/strong>/);
      const reviewMatch = block.match(/<span class="rating-total-count">\(([\d,]+)\)<\/span>/);

      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";

      const price = priceMatch
        ? Number(priceMatch[1].replace(/[^\d]/g, ""))
        : null;

      const reviewCount = reviewMatch
        ? Number(reviewMatch[1].replace(/,/g, ""))
        : 0;

      let deliveryType = "판매자배송";

      if (block.includes("로켓배송")) {
        deliveryType = "로켓배송";
      } else if (block.includes("판매자로켓")) {
        deliveryType = "판매자로켓";
      }

      if (title) {
        items.push({
          rank: items.length + 1,
          title,
          price,
          reviewCount,
          deliveryType
        });
      }
    }

    const total = items.length || 1;

    const rocketCount = items.filter((x) => x.deliveryType === "로켓배송").length;
    const sellerRocketCount = items.filter((x) => x.deliveryType === "판매자로켓").length;
    const sellerDeliveryCount = items.filter((x) => x.deliveryType === "판매자배송").length;

    const prices = items.map((x) => x.price).filter(Boolean);
    const reviews = items.map((x) => x.reviewCount);

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
      items
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch Coupang data",
      detail: error.message
    });
  }
}
