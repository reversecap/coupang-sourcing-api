export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { keyword, months = 36 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: "keyword is required" });
  }

  const endDate = new Date();
  const startDate = new Date();

  startDate.setMonth(startDate.getMonth() - months);

  const formatDate = (d) => d.toISOString().slice(0, 10);

  const body = {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    timeUnit: "month",
    keywordGroups: [
      {
        groupName: keyword,
        keywords: [keyword]
      }
    ]
  };

  const response = await fetch(
    "https://openapi.naver.com/v1/datalab/search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json();

  return res.status(response.status).json({
    keyword,
    months,
    source: "Naver DataLab",
    data
  });
}
