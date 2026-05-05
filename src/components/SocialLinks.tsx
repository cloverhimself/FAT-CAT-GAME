import { ReactNode } from "react";
import { FaXTwitter, FaYoutube, FaTiktok, FaInstagram, FaTelegram } from "react-icons/fa6";
import { FaGlobeAmericas } from "react-icons/fa";
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
  { label: "Aura", href: "https://fatcats.ai/aura", icon: <FaGlobeAmericas /> },
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
            className="group flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-white/20"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#ff8fca] via-[#ff965f] to-[#5ce9ff] text-sm text-[#122032] shadow-sm transition group-hover:scale-105">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
