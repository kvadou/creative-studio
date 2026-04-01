import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Poppins';

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['latin'],
});

export type KingChomperIntroProps = {
  characterName: string;
  title: string;
  subtitle: string;
  catchphrase: string;
  facts: string[];
};

// Scene 1: Chesslandia background reveal + title
const ChesslandiaReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = interpolate(frame, [0, 1 * fps], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const titleDrop = spring({
    frame: frame - 0.5 * fps,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const titleY = interpolate(titleDrop, [0, 1], [-80, 0]);
  const titleOpacity = interpolate(titleDrop, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtle parallax on background
  const bgScale = interpolate(frame, [0, 3 * fps], [1.1, 1.0], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {/* Background */}
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <Img
          src={staticFile('backgrounds/chesslandia-rolling-hills.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${bgScale})`,
          }}
        />
        {/* Gradient overlay for text readability */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(106,70,157,0.6) 0%, rgba(106,70,157,0.1) 40%, transparent 60%, rgba(26,26,46,0.4) 100%)',
          }}
        />
      </AbsoluteFill>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 72,
            fontWeight: 800,
            color: '#FFFFFF',
            textShadow: '0 4px 20px rgba(106,70,157,0.8), 0 2px 4px rgba(0,0,0,0.5)',
            letterSpacing: -1,
          }}
        >
          Welcome to Chesslandia
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: King Chomper entrance + name card
const CharacterEntrance: React.FC<{
  characterName: string;
  subtitle: string;
}> = ({ characterName, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Character bounces in from left
  const characterSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 80 }, // bouncy!
  });
  const characterX = interpolate(characterSpring, [0, 1], [-600, 60]);
  const characterScale = interpolate(characterSpring, [0, 1], [0.6, 1]);

  // Name card slides in from right with delay
  const nameSpring = spring({
    frame: frame - 0.6 * fps,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const nameX = interpolate(nameSpring, [0, 1], [400, 0]);
  const nameOpacity = interpolate(nameSpring, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtitle fades in after name
  const subtitleSpring = spring({
    frame: frame - 1.2 * fps,
    fps,
    config: { damping: 200 },
  });

  // Crown sparkle effect
  const sparkle = Math.sin(frame * 0.3) * 0.15 + 0.85;

  return (
    <AbsoluteFill>
      {/* Character */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: characterX,
          transform: `scale(${characterScale})`,
          transformOrigin: 'bottom left',
          filter: `brightness(${sparkle + 0.15})`,
        }}
      >
        <Img
          src={staticFile('characters/king-chomper.png')}
          style={{
            height: 850,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Name card */}
      <div
        style={{
          position: 'absolute',
          right: 100,
          top: '50%',
          transform: `translateX(${nameX}px) translateY(-50%)`,
          opacity: nameOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        {/* Name with purple backing */}
        <div
          style={{
            background: 'linear-gradient(135deg, #6A469D 0%, #4A2D7A 100%)',
            padding: '16px 48px',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(106,70,157,0.6)',
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 88,
              fontWeight: 900,
              color: '#FFFFFF',
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {characterName.toUpperCase()}
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 16,
            opacity: subtitleSpring,
            transform: `translateY(${interpolate(subtitleSpring, [0, 1], [20, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 600,
              color: '#FACC29',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Character facts
const CharacterFacts: React.FC<{ facts: string[] }> = ({ facts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {/* Character stays visible (shifted left a bit) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 40,
        }}
      >
        <Img
          src={staticFile('characters/king-chomper.png')}
          style={{
            height: 750,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Facts panel on right */}
      <div
        style={{
          position: 'absolute',
          right: 80,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 700,
        }}
      >
        {facts.map((fact, i) => {
          const factSpring = spring({
            frame: frame - i * 0.5 * fps,
            fps,
            config: { damping: 15, stiffness: 100 },
          });
          const factX = interpolate(factSpring, [0, 1], [200, 0]);

          return (
            <div
              key={i}
              style={{
                opacity: factSpring,
                transform: `translateX(${factX}px)`,
                background: 'rgba(255,255,255,0.92)',
                borderRadius: 16,
                padding: '20px 32px',
                borderLeft: '6px solid #50C8DF',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              <div
                style={{
                  fontFamily,
                  fontSize: 32,
                  fontWeight: 600,
                  color: '#1a1a2e',
                  lineHeight: 1.3,
                }}
              >
                {fact}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Catchphrase + logo
const CatchphraseScene: React.FC<{ catchphrase: string }> = ({
  catchphrase,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Big bouncy entrance for catchphrase
  const phraseSpring = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 80 }, // very bouncy
  });
  const phraseScale = interpolate(phraseSpring, [0, 1], [0, 1]);
  const phraseRotation = interpolate(phraseSpring, [0, 1], [-5, 0]);

  // Wobble after landing
  const wobble = frame > 1 * fps ? Math.sin((frame - 1 * fps) * 0.15) * 2 : 0;

  // Logo fades in
  const logoOpacity = interpolate(frame, [1 * fps, 1.5 * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Character celebrates
  const celebrateSpring = spring({
    frame: frame - 0.3 * fps,
    fps,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill>
      {/* Celebrating Chomper in center */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(celebrateSpring, [0, 1], [0.8, 1])})`,
          transformOrigin: 'bottom center',
          opacity: celebrateSpring,
        }}
      >
        <Img
          src={staticFile('characters/king-chomper-celebrate.png')}
          style={{
            height: 650,
            width: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Catchphrase */}
      <div
        style={{
          position: 'absolute',
          top: 100,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${phraseScale}) rotate(${phraseRotation + wobble}deg)`,
            background: 'linear-gradient(135deg, #FACC29 0%, #F59E0B 100%)',
            padding: '24px 56px',
            borderRadius: 24,
            boxShadow: '0 8px 40px rgba(245,158,11,0.5), 0 0 0 4px #FFFFFF',
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 52,
              fontWeight: 900,
              color: '#4A2D7A',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {catchphrase}
          </div>
        </div>
      </div>

      {/* Acme Creative Logo watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          opacity: logoOpacity,
        }}
      >
        <Img
          src={staticFile('brand/logo.png')}
          style={{ height: 80, width: 'auto' }}
        />
      </div>
    </AbsoluteFill>
  );
};

// Main composition
export const KingChomperIntro: React.FC<KingChomperIntroProps> = ({
  characterName,
  subtitle,
  catchphrase,
  facts,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#E8FBFF' }}>
      {/* Background persists throughout */}
      <Sequence from={0} durationInFrames={15 * fps} premountFor={fps}>
        <ChesslandiaReveal />
      </Sequence>

      {/* Character entrance (scene 2) */}
      <Sequence from={3 * fps} durationInFrames={5 * fps} premountFor={fps}>
        <CharacterEntrance
          characterName={characterName}
          subtitle={subtitle}
        />
      </Sequence>

      {/* Character facts (scene 3) */}
      <Sequence from={8 * fps} durationInFrames={4 * fps} premountFor={fps}>
        <CharacterFacts facts={facts} />
      </Sequence>

      {/* Catchphrase + logo (scene 4) */}
      <Sequence from={12 * fps} durationInFrames={3 * fps} premountFor={fps}>
        <CatchphraseScene catchphrase={catchphrase} />
      </Sequence>
    </AbsoluteFill>
  );
};
