import { ReactNode } from "react";
import { FaXTwitter, FaYoutube, FaTiktok, FaInstagram, FaTelegram } from "react-icons/fa6";
import { HiGlobeAlt } from "react-icons/hi";
import { BsGraphUpArrow } from "react-icons/bs";

type LinkItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

const links: LinkItem[] = [
  { label: "Twitter", href: "https://x.com/fatcatsai", icon: <FaXTwitter /> },
  { label: "YouTube", href: "https://www.youtube.com/@fatcats_ai", icon: <FaYoutube /> },
  { label: "TikTok", href: "https://www.tiktok.com/@fatcatsai_", icon: <FaTiktok /> },
  { label: "Instagram", href: "https://www.instagram.com/fatcatsai", icon: <FaInstagram /> },
  { label: "Telegram", href: "https://t.me/fatcatsunited", icon: <FaTelegram /> },
  { label: "Aura", href: "https://fatcats.ai/aura", icon: <HiGlobeAlt /> },
  {
    label: "Dexscreener",
    href: "https://dexscreener.com/solana/FCUnZjb8kb3N4tExZ9NXPxaNRVwudaBCA6ATC6X94kiM",
    icon: <BsGraphUpArrow />,
  },
];

export function SocialLinks() {
  return (
    <section className="glass-panel rounded-2xl p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/85">FAT CAT Community</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {links.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm text-white transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
