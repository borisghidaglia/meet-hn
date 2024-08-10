export const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded bg-[#99999a] px-2.5 py-0.5 text-xs font-medium text-white">
    {children}
  </span>
);

export const parseTags = (about: string) => {
  const matchedTags = about.match(/Interests:\n([\s\S]*?)(?=<p>---)/);

  if (!matchedTags || !matchedTags[1]) return [];

  const tags = matchedTags[1]
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => supportedTags.includes(tag as SupportedTag));

  return tags;
};

export type SupportedTag = (typeof supportedTags)[number];
export const supportedTags = [
  "AI/ML",
  "AR/VR",
  "Art",
  "Biotech",
  "Blockchain",
  "Books",
  "Climate Tech",
  "Climbing",
  "Cybersecurity",
  "Cycling",
  "Data Science",
  "DevOps",
  "Digital Nomad",
  "Education",
  "Entrepreneurship",
  "Fintech",
  "Fitness",
  "Freelancing",
  "Gaming",
  "Hacking",
  "Hardware",
  "Healthcare",
  "Hiking",
  "Investment",
  "IoT",
  "Legal Tech",
  "Marketing",
  "Martial Arts",
  "Media",
  "Mentorship",
  "Mobile Development",
  "Music",
  "Networking",
  "Open Source",
  "Outdoor Activities",
  "Philosophy",
  "Privacy",
  "Programming",
  "Remote Work",
  "Research",
  "Robotics",
  "Running",
  "Science",
  "Social Impact",
  "Space Tech",
  "Sports",
  "Startups",
  "Technology",
  "Travel",
  "UI/UX Design",
  "Web Development",
  "Writing",
  "Yoga",
] as const;
