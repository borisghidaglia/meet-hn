export async function fetchHnUser(username: string) {
  const hnUser: null | { about: string; karma: number; created: number } =
    await fetch(
      `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
    ).then((res) => res.json());

  return hnUser;
}
