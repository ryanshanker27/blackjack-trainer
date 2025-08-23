/**
 * Resolve a blackjack round in a pure function.
 *
 * @param {Object} params
 * @param {Array<Array<{rank:string, value:number, suit?:string}>>} params.playerHands
 *        One or more player hands. Each hand is an array of card objects with rank & value.
 * @param {Array<{rank:string, value:number, suit?:string}>} params.dealerHand
 *        Dealer's hand (as seen so far). This function will draw out the dealer hand.
 * @param {number} params.bankroll
 *        Current bankroll AFTER initial wagers have been deducted (matches your UI flow).
 * @param {Array<number>} [params.handBets=[]]
 *        Per-hand bet amounts. If missing for an index, falls back to `defaultBet`.
 * @param {number} [params.defaultBet=25]
 *        Default bet amount per hand when `handBets[index]` is undefined.
 * @param {boolean} [params.dealerHitsSoft17=true]
 *        House rule: dealer hits soft 17 if true, stands if false.
 * @param {boolean} [params.considerNaturalBlackjack=true]
 *        If true, pay 3:2 blackjacks (player 21 on exactly two cards)
 *        and handle dealer natural push. If false, treat all 21s as normal totals.
 * @returns {{
*   bankroll: number,
*   outcomes: Array<{ result: 'win'|'loss'|'push'|'blackjack'|'bust'|'surrender', bet: number, playerValue: number }>,
*   dealerFinalHand: Array<{rank:string, value:number, suit?:string}>,
*   dealerValue: number
* }}
*/
export function resolveBlackjackRound({
 playerHands,
 dealerHand,
 bankroll,
 handBets = [],
 defaultBet = 25,
 dealerHitsSoft17 = true,
 considerNaturalBlackjack = true
}) {
 // ---------- Helpers ----------
 const calcValue = (hand) => {
   let value = 0;
   let aces = 0;
   for (const c of hand) {
     value += c.value;
     if (c.rank === 'A') aces++;
   }
   while (value > 21 && aces > 0) {
     value -= 10; // convert an Ace from 11 to 1
     aces--;
   }
   return value;
 };

 // Hand is "soft" if at least one Ace is still counted as 11 after adjustment.
 const isSoft = (hand) => {
   let base = 0;
   let aces = 0;
   for (const c of hand) {
     if (c.rank === 'A') {
       aces += 1;
       base += 1; // count Aces as 1 initially
     } else {
       base += c.value;
     }
   }
   return aces > 0 && base + 10 <= 21;
 };

 const isBlackjack = (hand) => hand.length === 2 && calcValue(hand) === 21;

 // ---------- Dealer draws out hand (using only the cards provided; no deck needed here) ----------
 // In your React app, cards are popped from a deck. For a pure resolver, we assume dealerHand
 // already contains the full sequence they would draw (e.g., in tests you pass the final dealer hand),
 // OR we simulate only the *rule* boundary (stop condition) given the provided sequence.
 // To keep it deterministic and safe (no randomness), we only "draw" from the given dealerHand array
 // (i.e., if dealerHand has more than 2 cards, we treat them as the draw order).
 let dealerIdx = 2; // next card to "reveal" if present
 let dealerShown = dealerHand.slice(0, Math.min(2, dealerHand.length));
 let dVal = calcValue(dealerHand);

 while (
   (dVal < 17) ||
   (dVal === 17 && dealerHitsSoft17 && isSoft(dealerShown))
 ) {
   if (dealerIdx >= dealerHand.length) {
     // No more cards provided to draw. Break to avoid randomness in a pure function.
     break;
   }
   dealerShown = dealerShown.concat(dealerHand[dealerIdx]);
   dealerIdx += 1;
   dVal = calcValue(dealerShown);
 }

 // ---------- Natural blackjack handling (player/dealer exactly two cards) ----------
 // Match your start-of-hand logic, but done here in a pure way:
 // - If player has blackjack and dealer also has blackjack -> push (return 1× bet)
 // - If player has blackjack and dealer doesn't -> pay 3:2 (return 2.5× bet)
 // Note: If you pass split hands with 2 cards totaling 21, casinos don't pay 3:2 on split 21s.
 // Here we use a simple rule: "natural BJ only if exactly two initial cards AND only one hand".
 const outcomes = [];
 let totalPayout = 0;

 const dealerNatural = considerNaturalBlackjack && isBlackjack(dealerShown);

 // If we're in a true initial situation (one player hand of exactly two cards),
 // handle natural BJ edge cases up front.
 const treatAsInitial = considerNaturalBlackjack &&
                        playerHands.length === 1 &&
                        playerHands[0].length === 2;

 if (treatAsInitial) {
   const bet0 = handBets[0] ?? defaultBet;
   const playerNatural = isBlackjack(playerHands[0]);

   if (playerNatural && dealerNatural) {
     // Push: return 1× bet
     totalPayout += bet0;
     outcomes.push({ result: 'push', bet: bet0, playerValue: 21 });
     return {
       bankroll: Math.max(0, bankroll + totalPayout),
       outcomes,
       dealerFinalHand: dealerHand,
       dealerValue: dVal
     };
   } else if (playerNatural && !dealerNatural) {
     // Blackjack: pay 3:2 → 2.5× bet returned including stake
     totalPayout += bet0 * 2.5;
     outcomes.push({ result: 'blackjack', bet: bet0, playerValue: 21 });
     return {
       bankroll: Math.max(0, bankroll + totalPayout),
       outcomes,
       dealerFinalHand: dealerHand,
       dealerValue: dVal
     };
   }
   // Otherwise, fall through to normal resolution.
 }

 // ---------- Normal resolution (wins = 2×, pushes = 1×, losses = 0×) ----------
 for (let i = 0; i < playerHands.length; i++) {
   const hand = playerHands[i];
   const bet = handBets[i] ?? defaultBet;
   const pVal = calcValue(hand);

   if (pVal > 21) {
     outcomes.push({ result: 'bust', bet, playerValue: pVal });
     continue;
   }

   if (dVal > 21) {
     totalPayout += bet * 2; // even money
     outcomes.push({ result: 'win', bet, playerValue: pVal });
     continue;
   }

   if (pVal > dVal) {
     totalPayout += bet * 2;
     outcomes.push({ result: 'win', bet, playerValue: pVal });
   } else if (pVal < dVal) {
     outcomes.push({ result: 'loss', bet, playerValue: pVal });
   } else {
     totalPayout += bet; // push
     outcomes.push({ result: 'push', bet, playerValue: pVal });
   }
 }

 return {
   bankroll: Math.max(0, bankroll + totalPayout),
   outcomes,
   dealerFinalHand: dealerShown,
   dealerValue: dVal
 };
}
