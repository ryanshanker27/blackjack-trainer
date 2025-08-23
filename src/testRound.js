import { resolveBlackjackRound } from './blackjackLogic.js';

const result = resolveBlackjackRound({
  playerHands: [[{ rank: '4', value: 4 }, { rank: 'Q', value: 10 }, { rank: 'K', value: 10 }]], // hard 20
  dealerHand: [
    { rank: '6', value: 6 },
    { rank: '7', value: 7 }
  ], // dealer 16
  bankroll: 975,
  handBets: [25],
  defaultBet: 25
});

console.log(result);