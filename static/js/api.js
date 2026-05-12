export async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Yêu cầu thất bại: ${response.status}`);
  }
  return response.json();
}

export async function fetchDashboardData(queryString) {
  const [summary, distributions, trend] = await Promise.all([
    getJson(`/api/summary?${queryString}`),
    getJson(`/api/distributions?${queryString}`),
    getJson(`/api/trend?${queryString}`),
  ]);

  return { summary, distributions, trend };
}

