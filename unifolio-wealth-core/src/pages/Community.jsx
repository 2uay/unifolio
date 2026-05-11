import React from 'react';
import { MessageCircle, Users, Megaphone, Bug, Lightbulb, HelpCircle } from 'lucide-react';

const DISCORD_URL = 'https://discord.gg/K5BzxfbUBT';

const channels = [
  { emoji: '🔴', name: 'announcements', desc: 'Release notes and updates' },
  { emoji: '🟠', name: 'roadmap', desc: 'Where we\'re headed' },
  { emoji: '🟡', name: 'feature-requests', desc: 'Shape the product' },
  { emoji: '🟨', name: 'bug-reports', desc: 'Help us ship quality' },
  { emoji: '🌊', name: 'general', desc: 'Casual discussion' },
  { emoji: '🩵', name: 'portfolios', desc: 'Share your setup' },
  { emoji: '🔵', name: 'market-talk', desc: 'Stocks, crypto, macro' },
  { emoji: '💜', name: 'faq', desc: 'Common questions answered' },
];

const highlights = [
  { icon: Megaphone, label: 'Early Access', desc: 'Be first to see new features before they ship.' },
  { icon: Bug, label: 'Direct Bug Reports', desc: 'Report issues straight to the team — not a ticket queue.' },
  { icon: Lightbulb, label: 'Shape the Roadmap', desc: 'Upvote features and influence what gets built next.' },
  { icon: HelpCircle, label: 'Community Support', desc: 'Get help from other Unifolio users and the team.' },
];

export default function Community() {
  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-12">

      {/* Hero */}
      <div className="text-center space-y-5">
        <div className="flex justify-center">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#5865F2] shadow-lg shadow-[#5865F2]/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-[#5865F2]/50"
            aria-label="Join Unifolio on Discord"
          >
            {/* Discord logo SVG */}
            <svg viewBox="0 0 127.14 96.36" className="w-12 h-12 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
            </svg>
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-background" />
          </a>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Join the Community</h1>
          <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            The Unifolio Discord is where the product gets built in public — feature requests, roadmap votes, early access, and direct access to the team.
          </p>
        </div>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium transition-colors shadow-md shadow-[#5865F2]/25"
        >
          <svg viewBox="0 0 127.14 96.36" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
          Join Discord
        </a>
      </div>

      {/* Why join */}
      <div className="grid sm:grid-cols-2 gap-3">
        {highlights.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex gap-3 p-4 rounded-xl bg-card border border-border">
            <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Channel preview */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Channels</h2>
        <div className="rounded-xl border border-border overflow-hidden bg-card divide-y divide-border/60">
          {channels.map(({ emoji, name, desc }) => (
            <a
              key={name}
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors group"
            >
              <span className="text-base w-5 text-center">{emoji}</span>
              <span className="text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">#{name}</span>
              <span className="text-xs text-muted-foreground/60 ml-auto">{desc}</span>
            </a>
          ))}
          <div className="px-4 py-2.5 text-xs text-muted-foreground/40 italic">+ 11 more channels</div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="text-center pb-4">
        <p className="text-xs text-muted-foreground/50">
          Free to join · No account required to browse · Direct access to the founder
        </p>
      </div>
    </div>
  );
}
