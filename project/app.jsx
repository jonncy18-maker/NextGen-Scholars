// Host: wraps <NGSSite/> inside an iOS frame (or full-bleed desktop view),
// and exposes a Tweaks panel for palette + font + viewport variations.

const { useState, useEffect } = React;

// Tweak defaults (host can rewrite this block on disk via __edit_mode_set_keys)
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "viewport": "iphone",
  "palette": "navyGold",
  "headingFont": "newsreader",
  "darkMode": false
}/*EDITMODE-END*/;

const PALETTES = {
  navyGold: {
    navy: '#1B2A4A', navyDeep: '#131F38', navyInk: '#0E1A33',
    gold: '#C9A84C', goldSoft: '#E4C97A',
    paper: '#FAF7F0', paper2: '#F2EDE2',
    red: '#B11B2A', blue: '#0038A8', yellow: '#FCD116',
    label: 'Navy + Gold (default)',
  },
  midnightCopper: {
    navy: '#16213B', navyDeep: '#0F1828', navyInk: '#0B1220',
    gold: '#C97A3F', goldSoft: '#E8A471',
    paper: '#F7F2EA', paper2: '#EEE6D7',
    red: '#A82935', blue: '#0F3470', yellow: '#E8B931',
    label: 'Midnight + Copper',
  },
  inkChampagne: {
    navy: '#222B3D', navyDeep: '#1A2233', navyInk: '#121826',
    gold: '#B89968', goldSoft: '#D4B98A',
    paper: '#F4F0E8', paper2: '#EBE4D5',
    red: '#9F2433', blue: '#1B3F75', yellow: '#E0BE36',
    label: 'Ink + Champagne',
  },
};

const FONT_STACKS = {
  newsreader: {
    label: 'Newsreader + Manrope',
    display: "'Newsreader', 'Source Serif Pro', 'Iowan Old Style', Georgia, serif",
    body: "'Manrope', 'Helvetica Neue', Helvetica, system-ui, sans-serif",
  },
  fraunces: {
    label: 'Lora + Geist',
    display: "'Lora', 'Iowan Old Style', Georgia, serif",
    body: "'Geist', 'Helvetica Neue', Helvetica, system-ui, sans-serif",
  },
  spectral: {
    label: 'Spectral + DM Sans',
    display: "'Spectral', 'Iowan Old Style', Georgia, serif",
    body: "'DM Sans', 'Helvetica Neue', Helvetica, system-ui, sans-serif",
  },
};

function ApplyVars({ palette, fonts }) {
  // Push palette + font values into CSS variables on :root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ngs-navy', palette.navy);
    root.style.setProperty('--ngs-navy-deep', palette.navyDeep);
    root.style.setProperty('--ngs-navy-ink', palette.navyInk);
    root.style.setProperty('--ngs-gold', palette.gold);
    root.style.setProperty('--ngs-gold-soft', palette.goldSoft);
    root.style.setProperty('--ngs-paper', palette.paper);
    root.style.setProperty('--ngs-paper-2', palette.paper2);
    root.style.setProperty('--ngs-red', palette.red);
    root.style.setProperty('--ngs-display', fonts.display);
    root.style.setProperty('--ngs-sans', fonts.body);
  }, [palette, fonts]);
  return null;
}

function FrameLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
      fontSize: 11,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'rgba(255, 255, 255, 0.45)',
      marginBottom: 18,
      textAlign: 'center',
    }}>{children}</div>
  );
}

// Browser chrome for the desktop view
function BrowserChrome({ children, palette }) {
  return (
    <div style={{
      width: 1280, maxWidth: '92vw',
      borderRadius: 12,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 40px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.18)',
    }}>
      <div style={{
        height: 38,
        background: 'linear-gradient(#2a2f3a, #1f2530)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8,
        borderBottom: '1px solid rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#ff5f57' }}/>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#febc2e' }}/>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28c840' }}/>
        </div>
        <div style={{
          flex: 1,
          margin: '0 80px',
          height: 22,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: 0.04,
        }}>
          nextgenscholars.ph
        </div>
      </div>
      <div style={{ height: 720, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = PALETTES[t.palette] || PALETTES.navyGold;
  const fonts = FONT_STACKS[t.headingFont] || FONT_STACKS.newsreader;

  const isDesktop = t.viewport === 'desktop';
  const isMobile = t.viewport === 'iphone';

  return (
    <>
      <ApplyVars palette={palette} fonts={fonts}/>

      <div style={{
        minHeight: '100vh',
        background:
          'radial-gradient(120% 80% at 50% 0%, #1a2236 0%, #0a0e18 60%, #06080f 100%)',
        padding: isMobile ? '48px 20px 80px' : '40px 20px 80px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        fontFamily: "'Manrope', system-ui, sans-serif",
      }}>
        <FrameLabel>
          {isMobile ? 'NGS · iPhone · 402 × 874' : 'NGS · Desktop · 1280 wide'}
        </FrameLabel>

        {isMobile ? (
          <IOSDevice width={402} height={844}>
            <div style={{
              height: '100%', overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: palette.paper,
            }}>
              <NGSSite palette={palette} isMobile={true}/>
            </div>
          </IOSDevice>
        ) : (
          <BrowserChrome palette={palette}>
            <div style={{ background: palette.paper }} className="ngs-desktop-host">
              <div className="ngs-site-wrap">
                <DesktopSite palette={palette}/>
              </div>
            </div>
          </BrowserChrome>
        )}

        <div style={{
          marginTop: 32,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: 'rgba(255,255,255,0.32)',
          letterSpacing: 0.04,
          textAlign: 'center',
          maxWidth: 520,
          lineHeight: 1.6,
        }}>
          Open Tweaks → switch palette / fonts / viewport.<br/>
          Mobile is primary; desktop scales the same layout up at <em>≥960px</em>.
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="View">
          <TweakRadio
            label="Viewport"
            value={t.viewport}
            onChange={v => setTweak('viewport', v)}
            options={[
              { value: 'iphone', label: 'Mobile' },
              { value: 'desktop', label: 'Desktop' },
            ]}
          />
        </TweakSection>

        <TweakSection label="Palette">
          <TweakSelect
            label="Color scheme"
            value={t.palette}
            onChange={v => setTweak('palette', v)}
            options={Object.entries(PALETTES).map(([k, v]) => ({
              value: k, label: v.label,
            }))}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[palette.navy, palette.gold, palette.paper, palette.red].map((c, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: 4,
                background: c,
                border: '1px solid rgba(255,255,255,0.1)',
              }}/>
            ))}
          </div>
        </TweakSection>

        <TweakSection label="Typography">
          <TweakSelect
            label="Type pairing"
            value={t.headingFont}
            onChange={v => setTweak('headingFont', v)}
            options={Object.entries(FONT_STACKS).map(([k, v]) => ({
              value: k, label: v.label,
            }))}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Desktop variant uses same NGSSite but adds .is-desktop class
function DesktopSite({ palette }) {
  return (
    <div className="ngs-desktop-shell">
      <NGSSite palette={palette}/>
      <style>{`
        .ngs-desktop-shell .ngs-site { /* trigger desktop styles via class */ }
        .ngs-desktop-shell .ngs-site { /* no-op */ }
      `}</style>
      <DesktopClass/>
    </div>
  );
}

// Mount .is-desktop on .ngs-site when in desktop viewport
function DesktopClass() {
  useEffect(() => {
    const el = document.querySelector('.ngs-desktop-shell .ngs-site');
    if (el) el.classList.add('is-desktop');
    return () => { if (el) el.classList.remove('is-desktop'); };
  });
  return null;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
