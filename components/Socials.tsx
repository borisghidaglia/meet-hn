export type Social = {
  allowedDomain: string[];
  url?: string;
  logo: React.ReactNode;
  name: string;
  pattern: RegExp;
};

export const Socials = ({ socials }: { socials: Social[] }) => {
  return (
    <ul className="flex flex-wrap items-center gap-1">
      {socials.map(({ url, logo }) =>
        url ? (
          <li key={url} className="grayscale hover:grayscale-0">
            <a href={url} rel="nofollow" target="_blank">
              {logo}
            </a>
          </li>
        ) : null,
      )}
    </ul>
  );
};

export function parseSocials(about: string) {
  return supportedSocials.map((social) => ({
    ...social,
    url: parseSocial(about, social.pattern, social.allowedDomain),
  }));
}

export const parseAtHnUrl = (about: string, username: string) => {
  const pattern = new RegExp(`(?:https:\/\/)?${username}\.at\.hn\/?`);
  const matchedStr = about.match(pattern)?.[0];
  if (!matchedStr) return;
  return matchedStr.startsWith("https://")
    ? matchedStr
    : `https://${matchedStr}`;
};

export function parseSocial(
  text: string,
  pattern: RegExp,
  allowedDomains: string[],
) {
  const matchedUrl = text.match(pattern)?.[0];

  if (!matchedUrl) return;

  try {
    // Try parsing the matched URL
    const parsedUrl = new URL(matchedUrl);

    // Check if the domain is in our whitelist
    if (!allowedDomains.includes(parsedUrl.hostname)) return;

    // Check against length limits
    if (parsedUrl.href.length > 250) return;

    // Check if it passes character whitelist
    if (!/^[a-zA-Z0-9:\/._-]+$/.test(parsedUrl.href)) return;

    return matchedUrl;
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

export const supportedSocials: Social[] = [
  {
    name: "bluesky",
    pattern: /https:\/\/bsky\.app\/profile\/[\w.:-]+\/?/,
    allowedDomain: ["bsky.app"],
    logo: (
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="-20 -20 400 350"
        fill="#1185fd"
        aria-hidden="true"
      >
        <path d="M180 141.964C163.699 110.262 119.308 51.1817 78.0347 22.044C38.4971 -5.86834 23.414 -1.03207 13.526 3.43594C2.08093 8.60755 0 26.1785 0 36.5164C0 46.8542 5.66748 121.272 9.36416 133.694C21.5786 174.738 65.0603 188.607 105.104 184.156C107.151 183.852 109.227 183.572 111.329 183.312C109.267 183.642 107.19 183.924 105.104 184.156C46.4204 192.847 -5.69621 214.233 62.6582 290.33C137.848 368.18 165.705 273.637 180 225.702C194.295 273.637 210.76 364.771 295.995 290.33C360 225.702 313.58 192.85 254.896 184.158C252.81 183.926 250.733 183.645 248.671 183.315C250.773 183.574 252.849 183.855 254.896 184.158C294.94 188.61 338.421 174.74 350.636 133.697C354.333 121.275 360 46.8568 360 36.519C360 26.1811 357.919 8.61012 346.474 3.43851C336.586 -1.02949 321.503 -5.86576 281.965 22.0466C240.692 51.1843 196.301 110.262 180 141.964Z"></path>
      </svg>
    ),
  },
  {
    name: "instagram",
    pattern: /https:\/\/(?:www\.)?instagram\.com\/[\w.-]+\/?/,
    allowedDomain: ["instagram.com", "www.instagram.com"],
    logo: (
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 64 64"
      >
        <defs>
          <radialGradient
            xlinkHref="#B"
            id="A"
            cx="673.845"
            cy="1118.777"
            fx="673.845"
            fy="1118.777"
            r="646.025"
            gradientTransform="matrix(1.0070894,-0.16908936,0.10282533,0.61126605,-712.34381,-507.71826)"
          />
          <linearGradient id="B" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fed576" />
            <stop offset=".263" stopColor="#f47133" />
            <stop offset=".609" stopColor="#bc3081" />
            <stop offset="1" stopColor="#4c63d2" />
          </linearGradient>
          <radialGradient
            xlinkHref="#B"
            id="C"
            gradientTransform="matrix(1.0070894,-0.16908936,0.10282533,0.61126605,-712.34381,-507.71826)"
            cx="673.845"
            cy="1118.777"
            fx="673.845"
            fy="1118.777"
            r="646.025"
          />
        </defs>
        <g transform="matrix(.205031 0 0 .205031 -6.4757 55.842695)">
          <path
            d="M187.796-195.814c-2.745 0-5.46.14-8.135.414s-5.313.68-7.906 1.213-5.14 1.193-7.636 1.972l-7.326 2.69-6.975 3.368-6.582 4.005-6.15 4.6-5.675 5.155-5.16 5.67-4.605 6.143-4.01 6.576-3.37 6.967c-1.013 2.383-1.914 4.826-2.694 7.32s-1.44 5.04-1.974 7.63-.94 5.225-1.215 7.898-.413 5.385-.413 8.127.14 5.454.413 8.127a78.99 78.99 0 0 0 1.215 7.899c.534 2.6 1.194 5.136 1.974 7.63s1.68 4.936 2.694 7.32l3.37 6.967 4.01 6.575 4.605 6.144 5.16 5.67 5.675 5.155 6.15 4.6 6.582 4.005 6.975 3.368 7.326 2.69 7.636 1.972a79.21 79.21 0 0 0 7.906 1.214 80.02 80.02 0 0 0 8.135.413c2.745 0 5.46-.14 8.134-.413a79.21 79.21 0 0 0 7.906-1.214l7.637-1.972 7.326-2.69 6.974-3.368 6.583-4.005 6.15-4.6 5.676-5.155 5.16-5.67 4.605-6.144 4.01-6.575 3.37-6.967 2.694-7.32c.78-2.494 1.44-5.04 1.974-7.63l1.215-7.9c.274-2.673.414-5.385.414-8.127s-.14-5.454-.414-8.127a78.97 78.97 0 0 0-1.215-7.898c-.534-2.6-1.194-5.135-1.974-7.63l-2.694-7.32-3.37-6.967-4.01-6.576-4.605-6.143-5.16-5.67-5.676-5.155-6.15-4.6-6.583-4.005-6.974-3.368-7.326-2.69-7.637-1.972-7.906-1.213a80 80 0 0 0-8.134-.414zm0 27.526c1.815 0 3.606.09 5.37.268l5.2.787 5.023 1.28 4.81 1.747 4.573 2.19 4.3 2.605 4.02 2.997 3.706 3.362 3.365 3.702 3 4.016 2.608 4.306 2.19 4.57c.658 1.564 1.242 3.167 1.75 4.806s.935 3.314 1.28 5.02.6 3.442.787 5.205l.268 5.366c0 1.813-.09 3.603-.268 5.367s-.44 3.5-.787 5.205-.775 3.38-1.28 5.02l-1.75 4.806-2.19 4.57-2.608 4.305-3 4.017-3.365 3.702-3.706 3.362-4.02 2.997-4.3 2.605-4.573 2.19-4.81 1.747-5.023 1.28-5.2.786a53.78 53.78 0 0 1-5.371.268 53.8 53.8 0 0 1-5.372-.268l-5.2-.786c-1.707-.346-3.383-.774-5.024-1.28l-4.81-1.747-4.573-2.19-4.3-2.605-4.02-2.997-3.706-3.362-3.365-3.702-3-4.017-2.608-4.305-2.19-4.57-1.75-4.806-1.28-5.02-.787-5.205a53.63 53.63 0 0 1-.268-5.367 53.61 53.61 0 0 1 .268-5.366c.177-1.763.44-3.5.787-5.205a52.11 52.11 0 0 1 1.281-5.019l1.75-4.806 2.19-4.57 2.608-4.306 3-4.016 3.365-3.702 3.706-3.362 4.02-2.997 4.3-2.605 4.573-2.19a51.97 51.97 0 0 1 4.811-1.747l5.024-1.28c1.707-.346 3.445-.61 5.2-.787a53.8 53.8 0 0 1 5.372-.268z"
            fill="url(#C)"
          />
          <path
            d="M270.86-218.5a19.009 19.134 0 0 0-1.898.096 19.009 19.134 0 0 0-1.879.286 19.009 19.134 0 0 0-1.841.473 19.009 19.134 0 0 0-1.785.656 19.009 19.134 0 0 0-1.711.833 19.009 19.134 0 0 0-1.62.999 19.009 19.134 0 0 0-1.513 1.158 19.009 19.134 0 0 0-1.39 1.303 19.009 19.134 0 0 0-1.254 1.437 19.009 19.134 0 0 0-1.105 1.556 19.009 19.134 0 0 0-.945 1.658 19.009 19.134 0 0 0-.777 1.746 19.009 19.134 0 0 0-.599 1.815 19.009 19.134 0 0 0-.416 1.866 19.009 19.134 0 0 0-.229 1.898 19.009 19.134 0 0 0-.048 1.354 19.009 19.134 0 0 0 .095 1.911 19.009 19.134 0 0 0 .284 1.891 19.009 19.134 0 0 0 .47 1.853 19.009 19.134 0 0 0 .652 1.797 19.009 19.134 0 0 0 .827 1.723 19.009 19.134 0 0 0 .993 1.631 19.009 19.134 0 0 0 1.15 1.522 19.009 19.134 0 0 0 1.295 1.4 19.009 19.134 0 0 0 1.428 1.262 19.009 19.134 0 0 0 1.546 1.113 19.009 19.134 0 0 0 1.649.952 19.009 19.134 0 0 0 1.734.782 19.009 19.134 0 0 0 1.803.603 19.009 19.134 0 0 0 1.854.418 19.009 19.134 0 0 0 1.886.231 19.009 19.134 0 0 0 1.345.048 19.009 19.134 0 0 0 1.898-.095 19.009 19.134 0 0 0 1.879-.286 19.009 19.134 0 0 0 1.841-.473 19.009 19.134 0 0 0 1.785-.656 19.009 19.134 0 0 0 1.711-.832 19.009 19.134 0 0 0 1.62-1 19.009 19.134 0 0 0 1.513-1.157 19.009 19.134 0 0 0 1.39-1.304 19.009 19.134 0 0 0 1.254-1.437 19.009 19.134 0 0 0 1.105-1.556 19.009 19.134 0 0 0 .945-1.659 19.009 19.134 0 0 0 .777-1.746 19.009 19.134 0 0 0 .599-1.815 19.009 19.134 0 0 0 .416-1.866 19.009 19.134 0 0 0 .229-1.898 19.009 19.134 0 0 0 .048-1.354 19.009 19.134 0 0 0-.095-1.91 19.009 19.134 0 0 0-.284-1.891 19.009 19.134 0 0 0-.47-1.853 19.009 19.134 0 0 0-.652-1.797 19.009 19.134 0 0 0-.827-1.723 19.009 19.134 0 0 0-.993-1.631 19.009 19.134 0 0 0-1.151-1.523 19.009 19.134 0 0 0-1.294-1.4 19.009 19.134 0 0 0-1.428-1.262 19.009 19.134 0 0 0-1.546-1.112 19.009 19.134 0 0 0-1.649-.952 19.009 19.134 0 0 0-1.734-.782 19.009 19.134 0 0 0-1.803-.603 19.009 19.134 0 0 0-1.854-.419 19.009 19.134 0 0 0-1.886-.23 19.009 19.134 0 0 0-1.345-.048z"
            fill="url(#C)"
          />
          <path
            d="M172.658-272.08c-8.682-.014-16.43.022-23.39.12l-18.66.5c-5.528.24-10.412.553-14.796.958-2.192.202-4.26.428-6.22.677a136 136 0 0 0-5.579.821c-1.765.3-3.44.624-5.046.976s-3.14.732-4.62 1.14a81.54 81.54 0 0 0-4.305 1.316c-1.394.47-2.754.968-4.097 1.5-2.686 1.064-5.306 2.258-8.004 3.596-2.076 1.03-3.994 2.073-5.816 3.177s-3.548 2.27-5.238 3.54a69.42 69.42 0 0 0-5.027 4.182c-1.682 1.532-3.4 3.217-5.185 5.1-2.243 2.353-4.192 4.547-5.922 6.7-.865 1.076-1.675 2.14-2.438 3.21a62.1 62.1 0 0 0-2.163 3.232c-.68 1.09-1.324 2.2-1.94 3.342a67.2 67.2 0 0 0-1.773 3.538c-1.138 2.444-2.2 5.076-3.26 8.014a91.85 91.85 0 0 0-2.111 6.598c-.633 2.274-1.196 4.653-1.698 7.226s-.94 5.34-1.325 8.4a203.95 203.95 0 0 0-.994 10.089c-.28 3.706-.512 7.784-.702 12.323l-.45 15.092-.242 18.397-.07 22.237.205 32.337.64 24.5.493 9.57.616 7.93a138.68 138.68 0 0 0 .741 6.396c.27 1.888.56 3.54.872 4.97a112.08 112.08 0 0 0 2.244 8.636 97.95 97.95 0 0 0 2.83 8.06c1.042 2.59 2.182 5.088 3.422 7.492s2.58 4.714 4.02 6.933 2.98 4.347 4.624 6.384a75.68 75.68 0 0 0 5.233 5.844c1.847 1.86 3.795 3.63 5.848 5.312a82.35 82.35 0 0 0 6.47 4.79c2.073 1.386 4.124 2.655 6.19 3.82s4.15 2.222 6.292 3.183 4.338 1.826 6.632 2.604 4.684 1.47 7.21 2.084 5.2 1.153 8.03 1.623 5.855.873 9.087 1.22 6.68.634 10.385.874 7.665.432 11.92.586c6.573.238 16.523.377 27.997.43l37.145-.075 35.174-.493 13.374-.376 8.713-.448c1.87-.152 3.7-.332 5.466-.543s3.508-.452 5.204-.726 3.354-.58 4.983-.92a101.43 101.43 0 0 0 4.804-1.123c1.576-.4 3.13-.855 4.668-1.338s3.06-1.005 4.573-1.565a100.05 100.05 0 0 0 4.522-1.801c1.503-.64 3.004-1.324 4.51-2.05 2.313-1.114 4.175-2.043 5.81-2.95a40.27 40.27 0 0 0 4.434-2.824c1.396-1.028 2.784-2.198 4.384-3.672s3.413-3.25 5.658-5.496c1.973-1.972 3.637-3.686 5.072-5.245s2.644-2.962 3.704-4.314a45.89 45.89 0 0 0 2.82-4.002c.847-1.35 1.627-2.752 2.422-4.307 1.196-2.34 2.26-4.507 3.213-6.598a84.1 84.1 0 0 0 2.534-6.148 67.86 67.86 0 0 0 1.951-6.295c.564-2.19 1.05-4.502 1.47-7.038s.775-5.296 1.083-8.378.57-6.488.8-10.315l.61-12.847.524-15.977.374-17.8.144-18.612-.334-36.555-.447-16.373-.61-14.058-.76-10.96c-.276-3.05-.574-5.452-.89-7.076a119.55 119.55 0 0 0-1.172-5.357 110.16 110.16 0 0 0-1.385-5.153 101.93 101.93 0 0 0-1.598-4.947c-.568-1.615-1.17-3.196-1.8-4.743s-1.312-3.058-2.022-4.537-1.454-2.922-2.235-4.332-1.595-2.785-2.446-4.126-1.737-2.648-2.66-3.92a75.09 75.09 0 0 0-2.87-3.715 73.91 73.91 0 0 0-3.082-3.508 73.62 73.62 0 0 0-3.293-3.302c-1.133-1.066-2.3-2.098-3.504-3.096a75.68 75.68 0 0 0-3.716-2.889 78.06 78.06 0 0 0-3.928-2.682 81.34 81.34 0 0 0-4.138-2.476 85.61 85.61 0 0 0-4.35-2.268c-2.442-1.187-4.7-2.24-6.917-3.174a75.03 75.03 0 0 0-6.658-2.467c-2.27-.715-4.633-1.328-7.233-1.857s-5.435-.97-8.644-1.345-6.792-.678-10.89-.93-8.707-.45-13.97-.61l-17.886-.4-22.637-.267-28.988-.178zm15.055 27.502l41.803.238 15.77.304c4.343.122 7.657.265 9.6.43 2.53.213 4.94.48 7.245.8a99.46 99.46 0 0 1 6.6 1.139c2.1.44 4.103.94 6.02 1.504s3.748 1.196 5.505 1.895 3.437 1.468 5.054 2.31a51.47 51.47 0 0 1 4.67 2.755c1.5.995 2.946 2.067 4.35 3.222s2.765 2.393 4.094 3.717c1.403 1.397 2.697 2.82 3.89 4.288a46.9 46.9 0 0 1 3.293 4.579 46.35 46.35 0 0 1 2.742 5.015c.828 1.76 1.572 3.62 2.24 5.597s1.263 4.078 1.79 6.323a97.53 97.53 0 0 1 1.386 7.195c.4 2.56.742 5.29 1.032 8.213s.53 6.04.728 9.375c.158 2.675.296 6.205.413 10.374l.293 14.215.224 34.82-.255 34.787-.306 14.174L315.473-57c-.292 4.827-.6 8.885-.968 12.417-.185 1.766-.385 3.4-.607 4.933a82.37 82.37 0 0 1-.739 4.326 62.61 62.61 0 0 1-.905 3.9 57 57 0 0 1-1.109 3.657 63.83 63.83 0 0 1-1.349 3.596 89.01 89.01 0 0 1-1.625 3.717c-.507 1.095-1.04 2.16-1.604 3.197a51.6 51.6 0 0 1-1.776 3.02c-.62.977-1.27 1.926-1.95 2.845a47.23 47.23 0 0 1-2.126 2.672 46.51 46.51 0 0 1-2.307 2.5c-.8.805-1.63 1.582-2.49 2.332s-1.752 1.47-2.675 2.164-1.878 1.36-2.865 1.998-2.005 1.25-3.056 1.834-2.135 1.142-3.25 1.673a62.94 62.94 0 0 1-3.449 1.514 69.71 69.71 0 0 1-3.65 1.355c-2.5.852-5.137 1.6-7.913 2.245a106.2 106.2 0 0 1-8.752 1.638c-1.13.165-3.727.32-7.447.464l-14.176.394-40.19.522-42.066.066-16.52-.176-10.727-.334-7.91-.556c-2.456-.207-4.74-.437-6.88-.698s-4.133-.552-6.008-.88a80.49 80.49 0 0 1-5.295-1.1 61.05 61.05 0 0 1-4.74-1.358c-1.505-.5-2.944-1.05-4.344-1.655s-2.76-1.268-4.107-1.992-2.68-1.51-4.028-2.367c-1.017-.646-2-1.3-2.946-1.993s-1.86-1.384-2.74-2.108-1.725-1.47-2.54-2.238a46.45 46.45 0 0 1-2.344-2.378c-.75-.818-1.467-1.66-2.155-2.532a45.31 45.31 0 0 1-1.973-2.7 47.01 47.01 0 0 1-1.797-2.88c-.57-.99-1.112-2.014-1.627-3.07a55.36 55.36 0 0 1-1.465-3.277c-.46-1.128-.896-2.292-1.306-3.494-.82-2.405-1.54-4.965-2.166-7.695s-1.16-5.63-1.612-8.72-.816-6.366-1.106-9.848c-.214-2.565-.384-6.56-.514-11.6l-.272-17.925.1-45.695.787-43.664.6-15.384.34-5.085c.118-1.358.24-2.364.365-2.968.412-1.987.827-3.836 1.256-5.567a91.2 91.2 0 0 1 1.337-4.863c.466-1.518.957-2.94 1.482-4.287a47.04 47.04 0 0 1 1.691-3.841c.606-1.22 1.257-2.388 1.964-3.525s1.47-2.24 2.302-3.337 1.728-2.18 2.703-3.278 2.028-2.207 3.17-3.35a68.3 68.3 0 0 1 4.154-3.845 52.29 52.29 0 0 1 4.24-3.249c1.443-1 2.923-1.89 4.464-2.708s3.143-1.557 4.828-2.222 3.455-1.26 5.33-1.8a74.71 74.71 0 0 1 5.97-1.413c2.112-.414 4.355-.775 6.75-1.09s4.943-.587 7.667-.823c1.9-.164 5.174-.31 9.485-.433l15.69-.31 41.738-.255z"
            fill="url(#A)"
          />
        </g>
      </svg>
    ),
  },
  {
    name: "linkedin",
    pattern: /https:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/,
    allowedDomain: ["linkedin.com", "www.linkedin.com"],
    logo: (
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid"
        viewBox="0 0 256 256"
      >
        <path
          d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.907 39.907 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186l-.016 67.013ZM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009-.002-12.157 9.851-22.014 22.008-22.016 12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97v122.16ZM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453"
          fill="#0A66C2"
        />
      </svg>
    ),
  },
  {
    name: "reddit",
    pattern: /https:\/\/(?:www\.)?reddit\.com\/user\/[\w-]+\/?/,
    allowedDomain: ["reddit.com", "www.reddit.com"],
    logo: (
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 216 216"
      >
        <defs>
          <radialGradient
            id="snoo-radial-gragient"
            cx="169.75"
            cy="92.19"
            r="50.98"
            fx="169.75"
            fy="92.19"
            gradientTransform="matrix(1 0 0 .87 0 11.64)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#feffff" />
            <stop offset=".4" stopColor="#feffff" />
            <stop offset=".51" stopColor="#f9fcfc" />
            <stop offset=".62" stopColor="#edf3f5" />
            <stop offset=".7" stopColor="#dee9ec" />
            <stop offset=".72" stopColor="#d8e4e8" />
            <stop offset=".76" stopColor="#ccd8df" />
            <stop offset=".8" stopColor="#c8d5dd" />
            <stop offset=".83" stopColor="#ccd6de" />
            <stop offset=".85" stopColor="#d8dbe2" />
            <stop offset=".88" stopColor="#ede3e9" />
            <stop offset=".9" stopColor="#ffebef" />
          </radialGradient>
          <radialGradient
            xlinkHref="#snoo-radial-gragient"
            id="snoo-radial-gragient-2"
            cx="47.31"
            r="50.98"
            fx="47.31"
          />
          <radialGradient
            xlinkHref="#snoo-radial-gragient"
            id="snoo-radial-gragient-3"
            cx="109.61"
            cy="85.59"
            r="153.78"
            fx="109.61"
            fy="85.59"
            gradientTransform="matrix(1 0 0 .7 0 25.56)"
          />
          <radialGradient
            id="snoo-radial-gragient-4"
            cx="-6.01"
            cy="64.68"
            r="12.85"
            fx="-6.01"
            fy="64.68"
            gradientTransform="matrix(1.07 0 0 1.55 81.08 27.26)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f60" />
            <stop offset=".5" stopColor="#ff4500" />
            <stop offset=".7" stopColor="#fc4301" />
            <stop offset=".82" stopColor="#f43f07" />
            <stop offset=".92" stopColor="#e53812" />
            <stop offset="1" stopColor="#d4301f" />
          </radialGradient>
          <radialGradient
            xlinkHref="#snoo-radial-gragient-4"
            id="snoo-radial-gragient-5"
            cx="-73.55"
            cy="64.68"
            r="12.85"
            fx="-73.55"
            fy="64.68"
            gradientTransform="matrix(-1.07 0 0 1.55 62.87 27.26)"
          />
          <radialGradient
            id="snoo-radial-gragient-6"
            cx="107.93"
            cy="166.96"
            r="45.3"
            fx="107.93"
            fy="166.96"
            gradientTransform="matrix(1 0 0 .66 0 57.4)"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#172e35" />
            <stop offset=".29" stopColor="#0e1c21" />
            <stop offset=".73" stopColor="#030708" />
            <stop offset="1" />
          </radialGradient>
          <radialGradient
            xlinkHref="#snoo-radial-gragient"
            id="snoo-radial-gragient-7"
            cx="147.88"
            cy="32.94"
            r="39.77"
            fx="147.88"
            fy="32.94"
            gradientTransform="matrix(1 0 0 .98 0 .54)"
          />
          <radialGradient
            id="snoo-radial-gragient-8"
            cx="131.31"
            cy="73.08"
            r="32.6"
            fx="131.31"
            fy="73.08"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset=".48" stopColor="#7a9299" />
            <stop offset=".67" stopColor="#172e35" />
            <stop offset=".75" />
            <stop offset=".82" stopColor="#172e35" />
          </radialGradient>
        </defs>
        <path
          fill="#ff4500"
          strokeWidth="0"
          d="M108 0C48.35 0 0 48.35 0 108c0 29.82 12.09 56.82 31.63 76.37l-20.57 20.57C6.98 209.02 9.87 216 15.64 216H108c59.65 0 108-48.35 108-108S167.65 0 108 0Z"
        />
        <circle
          cx="169.22"
          cy="106.98"
          r="25.22"
          fill="url(#snoo-radial-gragient)"
          strokeWidth="0"
        />
        <circle
          cx="46.78"
          cy="106.98"
          r="25.22"
          fill="url(#snoo-radial-gragient-2)"
          strokeWidth="0"
        />
        <ellipse
          cx="108.06"
          cy="128.64"
          fill="url(#snoo-radial-gragient-3)"
          strokeWidth="0"
          rx="72"
          ry="54"
        />
        <path
          fill="url(#snoo-radial-gragient-4)"
          strokeWidth="0"
          d="M86.78 123.48c-.42 9.08-6.49 12.38-13.56 12.38s-12.46-4.93-12.04-14.01c.42-9.08 6.49-15.02 13.56-15.02s12.46 7.58 12.04 16.66Z"
        />
        <path
          fill="url(#snoo-radial-gragient-5)"
          strokeWidth="0"
          d="M129.35 123.48c.42 9.08 6.49 12.38 13.56 12.38s12.46-4.93 12.04-14.01c-.42-9.08-6.49-15.02-13.56-15.02s-12.46 7.58-12.04 16.66Z"
        />
        <ellipse
          cx="79.63"
          cy="116.37"
          strokeWidth="0"
          fill="#ffc49c"
          rx="2.8"
          ry="3.05"
        />
        <ellipse
          cx="146.21"
          cy="116.37"
          strokeWidth="0"
          fill="#ffc49c"
          rx="2.8"
          ry="3.05"
        />
        <path
          fill="url(#snoo-radial-gragient-6)"
          strokeWidth="0"
          d="M108.06 142.92c-8.76 0-17.16.43-24.92 1.22-1.33.13-2.17 1.51-1.65 2.74 4.35 10.39 14.61 17.69 26.57 17.69s22.23-7.3 26.57-17.69c.52-1.23-.33-2.61-1.65-2.74-7.77-.79-16.16-1.22-24.92-1.22Z"
        />
        <circle
          cx="147.49"
          cy="49.43"
          r="17.87"
          fill="url(#snoo-radial-gragient-7)"
          strokeWidth="0"
        />
        <path
          fill="url(#snoo-radial-gragient-8)"
          strokeWidth="0"
          d="M107.8 76.92c-2.14 0-3.87-.89-3.87-2.27 0-16.01 13.03-29.04 29.04-29.04 2.14 0 3.87 1.73 3.87 3.87s-1.73 3.87-3.87 3.87c-11.74 0-21.29 9.55-21.29 21.29 0 1.38-1.73 2.27-3.87 2.27Z"
        />
        <path
          fill="#842123"
          strokeWidth="0"
          d="M62.82 122.65c.39-8.56 6.08-14.16 12.69-14.16 6.26 0 11.1 6.39 11.28 14.33.17-8.88-5.13-15.99-12.05-15.99s-13.14 6.05-13.56 15.2c-.42 9.15 4.97 13.83 12.04 13.83h.52c-6.44-.16-11.3-4.79-10.91-13.2Zm90.48 0c-.39-8.56-6.08-14.16-12.69-14.16-6.26 0-11.1 6.39-11.28 14.33-.17-8.88 5.13-15.99 12.05-15.99 7.07 0 13.14 6.05 13.56 15.2.42 9.15-4.97 13.83-12.04 13.83h-.52c6.44-.16 11.3-4.79 10.91-13.2Z"
        />
      </svg>
    ),
  },
  {
    name: "soundcloud",
    pattern: /https:\/\/(www\.)?soundcloud\.com\/[\w-]+\/?/,
    allowedDomain: ["soundcloud.com", "www.soundcloud.com"],
    logo: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        className="h-5 w-5"
      >
        <rect width="512" height="512" rx="15%" fill="#f50" />
        <path
          d="m59 270-3 22 3 22c0 2 3 2 3 0l3-22-3-22c0-3-3-3-3 0zm18-14c0-3-3-3-3 0l-5 36 4 35c0 3 4 3 4 0l4-35zm59-30-3 66 2 40c0 8 7 8 7 0l4-40-4-66c0-5-6-5-6 0zm-31 22-4 44 3 40c0 6 5 6 5 0l4-40-4-44c0-3-4-3-4 0zm70 84 3-40-3-88c0-6-7-6-7 0l-3 88 2 40c0 8 8 8 8 0zm68 0 2-40-2-102c0-7-10-7-10 0l-2 102 2 40c0 8 10 8 10 0zm-34 0 3-40-3-89c0-6-9-6-9 0l-2 89 2 40c0 8 9 8 9 0zm-83 0 3-40-3-41c0-3-6-3-6 0l-3 41 3 40c0 7 6 7 6 0zm-33 0 4-40-4-43c0-3-4-3-4 0l-4 43 4 40c0 4 4 4 4 0zm124-125-2 85 1 40c0 8 10 8 10 0l2-40-2-85c0-7-9-7-9 0zm-58 125 3-40-3-81c0-6-7-6-7 0l-3 81 2 40c0 8 8 8 8 0zm33 0 3-40-3-91c0-6-8-6-8 0l-3 91 3 40c0 8 8 8 8 0zm196-89c-5-57-64-94-118-73-4 2-5 3-5 6v156c0 3 2 6 5 6h137c27 0 49-22 49-49 0-37-35-57-68-46zm-138-62-3 111 3 40c0 8 10 8 10 0l3-40-3-111c0-7-10-7-10 0z"
          fill="#fff"
        />
      </svg>
    ),
  },
  {
    name: "spotify",
    pattern: /https:\/\/open\.spotify\.com\/user\/[\w-]+\/?/,
    allowedDomain: ["open.spotify.com"],
    logo: (
      <svg
        viewBox="0 0 256 256"
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid"
      >
        <path
          d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007l.001-.006Zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.981 7.981 0 0 1-9.552-6.007 7.968 7.968 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975Zm15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72v-.001Zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187h-.006Z"
          fill="#1ED760"
        />
      </svg>
    ),
  },
  {
    name: "twitter",
    pattern: /https:\/\/(www\.)?(x\.com|twitter\.com)\/[\w-]+\/?/,
    allowedDomain: ["twitter.com", "www.twitter.com", "x.com", "www.x.com"],
    logo: (
      <svg
        className="h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 1200 1227"
      >
        <path
          fill="black"
          d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
        />
      </svg>
    ),
  },
  {
    name: "youtubeMusic",
    pattern: /https:\/\/music\.youtube\.com\/channel\/[\w-]+\/?/,
    allowedDomain: ["music.youtube.com"],
    logo: (
      <svg
        className="h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        xmlSpace="preserve"
        viewBox="0 0 192 192"
      >
        <path fill="none" d="M0 0h192v192H0z" />
        <circle cx="96" cy="96" r="88" fill="red" />
        <path
          fill="#FFF"
          d="M96 50.32c25.19 0 45.68 20.49 45.68 45.68S121.19 141.68 96 141.68 50.32 121.19 50.32 96 70.81 50.32 96 50.32m0-6.4c-28.76 0-52.08 23.32-52.08 52.08 0 28.76 23.32 52.08 52.08 52.08s52.08-23.32 52.08-52.08c0-28.76-23.32-52.08-52.08-52.08z"
        />
        <path fill="#FFF" d="m79 122 45-26-45-26z" />
      </svg>
    ),
  },
];
