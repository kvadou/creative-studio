import React from 'react';
import { Composition, Folder } from 'remotion';
import { TIMING, DIMENSIONS } from './lib/brand';
import {
  KingChomperIntro,
  KingChomperIntroProps,
} from './compositions/KingChomperIntro';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Character-Intros">
        <Composition
          id="KingChomperIntro"
          component={KingChomperIntro}
          durationInFrames={15 * TIMING.fps}
          fps={TIMING.fps}
          width={DIMENSIONS.landscape.width}
          height={DIMENSIONS.landscape.height}
          defaultProps={
            {
              characterName: 'King Chomper',
              title: 'Welcome to Chesslandia',
              subtitle: 'The White King',
              catchphrase: 'WHAAAAT IN THE\nCHEESY BISCUITS?!',
              facts: [
                '\u{1F451} The White King \u2014 ruler of the left side of the board',
                '\u{1F355} Food-obsessed \u2014 his crown is made of forks & meatballs!',
                '\u{1F3F0} Lives in King Chomper\u2019s Castle, full of snacks',
                '\u{265A} Moves one square in any direction',
              ],
            } satisfies KingChomperIntroProps
          }
        />
      </Folder>
    </>
  );
};
