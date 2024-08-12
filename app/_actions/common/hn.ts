export async function getHnUserAboutSection(username: string) {
  const hnUser: null | { about: string } = await fetch(
    `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
  ).then((res) => res.json());

  return hnUser?.about;
}
