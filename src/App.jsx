import React, { useState, useEffect, useCallback } from 'react';
import { Download, Upload, BarChart3, Settings, Play, TrendingUp } from 'lucide-react';

/**
 * MAIN BLACKJACK TRAINER COMPONENT
 * ================================
 * This is the root component that manages the entire blackjack training application.
 * It includes game logic, statistics tracking, optimal strategy calculation, and UI management.
 * 
 * Key Features:
 * - Full blackjack gameplay with splitting, doubling, insurance, surrender
 * - Real-time strategy analysis comparing user decisions to optimal play
 * - Comprehensive statistics tracking across multiple sessions
 * - Data export/import functionality for backup
 * - Customizable game rules (dealer hits soft 17, surrender allowed)
 */
const BlackjackTrainer = () => {
  
  // ==================== GAME STATE MANAGEMENT ====================
  /**
   * GAME STATE VARIABLES
   * These variables track the current state of the blackjack game.
   * They control what the player can do and what information is displayed.
   */
  
  // Controls the current phase of the game: 'betting' (choosing bet amount), 'playing' (making decisions), 'finished' (hand complete)
  const [gameState, setGameState] = useState('betting');
  
  // Array of player hands - multiple hands are created when splitting pairs
  // Each hand is an array of card objects with suit, rank, and value properties
  const [playerHands, setPlayerHands] = useState([[]]);
  
  // Track bet amounts for each hand separately (important for doubles and splits)
  const [handBets, setHandBets] = useState([]);

  // Dealer's hand - array of card objects, second card hidden during play
  const [dealerHand, setDealerHand] = useState([]);
  
  // Index of which split hand is currently active (0 for first hand, 1 for second, etc.)
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  
  // ==================== MONEY MANAGEMENT ====================
  /**
   * BETTING AND BANKROLL VARIABLES
   * These track the player's money and betting amounts.
   * All money is virtual for educational purposes.
   */
  
  // Player's total available money - starts at $1000 (typical casino minimum)
  const [bankroll, setBankroll] = useState(1000);
  
  // Amount being wagered on current hand - must be between $5-$500 (typical casino limits)
  const [currentBet, setCurrentBet] = useState(25);
  
  // Total number of hands being played this round (increases with splitting)
  const [handsToPlay, setHandsToPlay] = useState(1);
  
  // ==================== GAME RULE SETTINGS ====================
  /**
   * CUSTOMIZABLE GAME RULES
   * These settings change the optimal strategy and affect house edge.
   * Different casinos have different rules.
   */
  
  // Whether dealer must hit or stand on soft 17 (ace + 6) - affects optimal strategy significantly
  const [dealerHitsSoft17, setDealerHitsSoft17] = useState(true);
  
  // Whether players can surrender (forfeit half bet to avoid playing hand) - reduces house edge
  const [surrenderAllowed, setSurrenderAllowed] = useState(true);
  
  // Whether insurance is currently being offered (when dealer shows ace)
  const [insuranceOffered, setInsuranceOffered] = useState(false);
  
  // ==================== USER INTERFACE STATE ====================
  /**
   * UI NAVIGATION VARIABLES
   * These control which screen and tab the user is currently viewing.
   */
  
  // Main screen selection: 'game' (play blackjack), 'stats' (view statistics), 'settings' (configure options)
  const [activeView, setActiveView] = useState('game');
  
  // Statistics sub-tab selection: 'summary', 'strategy', 'scenarios', 'table'
  const [activeStatsTab, setActiveStatsTab] = useState('summary');
  
  // ==================== STATISTICS TRACKING ====================
  /**
   * COMPREHENSIVE STATISTICS SYSTEM
   * These variables track detailed gameplay data for strategy analysis.
   * All data persists across browser sessions using localStorage.
   */
  
  // Overall game statistics - tracks wins, losses, money wagered, etc.
  const [gameStats, setGameStats] = useState({
    totalHands: 0,           // Total number of hands played
    handsWon: 0,            // Hands where player beat dealer
    handsLost: 0,           // Hands where dealer beat player  
    handsPush: 0,           // Hands that tied (push)
    totalWagered: 0,        // Total amount of money bet
    netWinnings: 0,         // Total profit/loss (can be negative)
    blackjacks: 0,          // Number of blackjacks
    busts: 0,               // Hands where player went over 21
    surrenders: 0,          // Hands where player surrendered
    doubles: 0,             // Times player doubled down
    splits: 0,              // Times player split pairs
    insurances: 0           // Times player took insurance
  });
  
  // Detailed decision history - every single decision made for strategy analysis
  const [decisionHistory, setDecisionHistory] = useState([]);
  
  // Scenario-based statistics - performance in specific situations (hard 16 vs 10, etc.)
  const [scenarioStats, setScenarioStats] = useState({});

  // ==================== CARD AND DECK LOGIC ====================
  /**
   * CARD DECK MANAGEMENT
   * Functions to create, shuffle, and manage the deck of cards.
   * Uses standard 52-card deck with proper card values for blackjack.
   */
  
  // Creates a fresh, shuffled 52-card deck
  const createDeck = useCallback(() => {
    // Standard card suits and ranks
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    // Generate all 52 cards with proper blackjack values
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({
          suit,
          rank,
          // Aces = 11 initially (converted to 1 if needed), face cards = 10, numbers = face value
          value: rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank)
        });
      }
    }
    
    // Shuffle deck using Fisher-Yates algorithm (ensures truly random distribution)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }, []);

  // Initialize deck when component first loads
  const [deck, setDeck] = useState(() => createDeck());

  // ==================== HAND VALUE CALCULATION ====================
  /**
   * BLACKJACK HAND VALUE LOGIC
   * These functions calculate hand values and determine hand types.
   * Properly handles aces (can be 1 or 11) according to blackjack rules.
   */
  
  // Calculate the total value of a hand, properly handling aces
  const calculateHandValue = useCallback((hand) => {
    let value = 0;
    let aces = 0;
    
    // Sum all card values and count aces
    for (let card of hand) {
      value += card.value;
      if (card.rank === 'A') aces++;
    }
    
    // Convert aces from 11 to 1 if hand would bust (go over 21)
    while (value > 21 && aces > 0) {
      value -= 10; // Convert an ace from 11 to 1
      aces--;
    }

    // Final safety check
    if (isNaN(value)) {
      console.error('calculateHandValue returned NaN');
      return 0;
    }
    
    return value;
  }, []);

  // Determine if hand is "soft" (contains an ace counted as 11)
  const isSoftHand = useCallback((hand) => {
    let value = 0;
    let hasAce = false;
    
    // Calculate total and check for aces
    for (let card of hand) {
      value += card.value;
      if (card.rank === 'A') hasAce = true;
    }
    
    // Hand is soft if it has an ace AND the ace is being counted as 11 (total <= 21)
    return hasAce && value <= 21 && hand.some(card => card.rank === 'A');
  }, []);

  // Check if hand can be split (exactly 2 cards of same rank)
  const canSplit = useCallback((hand) => {
    return hand.length === 2 && hand[0].rank === hand[1].rank;
  }, []);

  // ==================== OPTIMAL STRATEGY ENGINE ====================
  /**
   * BASIC STRATEGY CALCULATION
   * This function implements mathematically optimal blackjack strategy.
   * Based on computer simulations of millions of hands.
   * Considers player hand, dealer up card, and available actions.
   */
  
  const getOptimalAction = useCallback((playerHand, dealerUpCard, canDouble = true, canSplit = true, canSurrender = true) => {
    // Safety check - ensure we have valid inputs
    if (!playerHand || !dealerUpCard || playerHand.length === 0) return 'hit';
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = dealerUpCard.value === 11 ? dealerUpCard.rank === 'A' ? 11 : dealerUpCard.value : dealerUpCard.value;
    const isSoft = isSoftHand(playerHand);
    const isPair = playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank;
    
    // PAIR SPLITTING STRATEGY
    // When to split pairs - based on mathematical expectation
    if (isPair && canSplit) {
      const rank = playerHand[0].rank;
      // Always split aces and 8s (fundamental blackjack rule)
      if (rank === 'A' || rank === '8') return 'split';
      // Split 9s against weak dealer cards (but not 7, 10, or ace)
      if (rank === '9' && ![7, 10, 11].includes(dealerValue)) return 'split';
      // Split 7s against dealer 7 or lower
      if (rank === '7' && dealerValue <= 7) return 'split';
      // Split 6s against dealer 6 or lower
      if (rank === '6' && dealerValue <= 6) return 'split';
      // Split small pairs (2,3) against dealer 7 or lower
      if (['2', '3'].includes(rank) && dealerValue <= 7) return 'split';
      // Split 4s only against dealer 5 or 6 (very specific situation)
      if (rank === '4' && [5, 6].includes(dealerValue)) return 'split';
    }
    
    // SOFT HAND STRATEGY
    // Strategy for hands containing aces (more aggressive doubling)
    if (isSoft) {
      // Always stand on soft 19 and 20
      if (playerValue >= 19) return 'stand';
      // Soft 18 strategy - stand vs weak dealers, hit vs strong dealers
      if (playerValue === 18) {
        if (canDouble && [3, 4, 5, 6].includes(dealerValue)) return 'double';
        if (dealerValue >= 9) return 'hit';
        return 'stand';
      }
      // Double soft 17 against weak dealers
      if (playerValue >= 17 && canDouble && [3, 4, 5, 6].includes(dealerValue)) return 'double';
      // Double soft 15-16 against dealer 4-6
      if (playerValue >= 15 && canDouble && [4, 5, 6].includes(dealerValue)) return 'double';
      // Double soft 13-14 against dealer 5-6
      if (playerValue >= 13 && canDouble && [5, 6].includes(dealerValue)) return 'double';
      // Otherwise hit soft hands
      return 'hit';
    }
    
    // HARD HAND STRATEGY
    // Strategy for hands without aces or where aces count as 1
    
    // Always stand on 17 or higher
    if (playerValue >= 17) return 'stand';
    // Stand on 13-16 against dealer weak cards (2-6)
    if (playerValue >= 13 && dealerValue <= 6) return 'stand';
    // Stand on 12 against dealer 4-6 (avoid busting against weak dealer)
    if (playerValue === 12 && [4, 5, 6].includes(dealerValue)) return 'stand';
    
    // DOUBLING STRATEGY
    // When to double down for maximum value
    // Always double 11 (best doubling situation)
    if (playerValue === 11 && canDouble) return 'double';
    // Double 10 against dealer 9 or lower
    if (playerValue === 10 && canDouble && dealerValue <= 9) return 'double';
    // Double 9 against dealer 3-6
    if (playerValue === 9 && canDouble && [3, 4, 5, 6].includes(dealerValue)) return 'double';
    
    // SURRENDER STRATEGY
    // When to give up half bet rather than play hand
    if (canSurrender && playerHand.length === 2) {
      // Surrender 16 against dealer 9, 10, or ace (very bad situation)
      if (playerValue === 16 && [9, 10, 11].includes(dealerValue)) return 'surrender';
      // Surrender 15 against dealer 10
      if (playerValue === 15 && dealerValue === 10) return 'surrender';
    }
    
    // Default action - hit when no other strategy applies
    return 'hit';
  }, [calculateHandValue, isSoftHand]);

  // ==================== GAME ACTION HANDLERS ====================
  /**
   * PLAYER ACTION FUNCTIONS
   * These functions handle all possible player actions during gameplay.
   * Each action updates game state and records decisions for analysis.
   */
  
  // Start a new hand - deals initial cards and sets up game state
 const startNewHand = useCallback(() => {
  // Reset/refresh deck
  let currentDeck = deck.length < 20 ? createDeck() : [...deck];
  if (currentDeck.length < 4) currentDeck = createDeck();

  // Init round state
  setGameState('playing');
  setPlayerHands([[]]);
  setDealerHand([]);
  setCurrentHandIndex(0);
  setHandsToPlay(1);
  setInsuranceOffered(false);

  // Deal
  const playerCard1 = currentDeck.pop();
  const dealerCard1 = currentDeck.pop();
  const playerCard2 = currentDeck.pop();
  const dealerCard2 = currentDeck.pop();

  setPlayerHands([[playerCard1, playerCard2]]);
  setDealerHand([dealerCard1, dealerCard2]);
  setDeck(currentDeck);

  // Commit the initial bet and record per-hand bets
  setHandBets([currentBet]);
  setBankroll(prev => prev - currentBet);

  // Natural blackjack handling
  const playerValue = calculateHandValue([playerCard1, playerCard2]);
  if (playerValue === 21) {
    setTimeout(() => {
      setGameState('finished');
      const dealerValue = calculateHandValue([dealerCard1, dealerCard2]);
      if (dealerValue === 21) {
        // push → return original bet
        setBankroll(prev => prev + currentBet);
        updateStats('push', currentBet, 0);
      } else {
        // 3:2 payout on blackjack (original + 1.5×bet)
        const winnings = currentBet * 2.5;
        setBankroll(prev => prev + winnings);
        updateStats('blackjack', currentBet, winnings - currentBet);
      }
    }, 500);
  } else if (dealerCard1 && dealerCard1.rank === 'A') {
    setInsuranceOffered(true);
  }
}, [deck, createDeck, currentBet, calculateHandValue]);


  // Player takes another card
  const hit = useCallback((handIndex = currentHandIndex) => {
    // Ensure deck has cards available
    if (deck.length === 0 || handIndex >= playerHands.length || !playerHands[handIndex]) {
      console.error('Cannot hit: invalid deck or hand state');
      return;
    }
    
    // Deal one card to specified hand
    const newDeck = [...deck];
    const newCard = newDeck.pop();
    
    // Safety check for card
    if (!newCard) {
      console.error('Failed to draw card from deck');
      return;
    }

    // Add card to player's hand
    const newHands = [...playerHands];
    newHands[handIndex] = [...newHands[handIndex], newCard];
    
    setPlayerHands(newHands);
    setDeck(newDeck);
    
    // Check if hand busted (went over 21)
    const handValue = calculateHandValue(newHands[handIndex]);
    if (handValue > 21) {
      // Hand busted - move to next hand or end game
      if (handIndex < handsToPlay - 1) {
        setCurrentHandIndex(handIndex + 1);  // Move to next split hand
      } else {
        finishHand('bust');  // All hands complete, end game
      }
    }
    
    // Record this decision for strategy analysis
    if (dealerHand.length > 0) {
      recordDecision(playerHands[handIndex], dealerHand[0], 'hit');
    }
  }, [currentHandIndex, deck, playerHands, handsToPlay, dealerHand, calculateHandValue]);

  // Player chooses to stand (take no more cards)
  const stand = useCallback(() => {
    try {
      // Safety checks
      if (currentHandIndex >= playerHands.length || !playerHands[currentHandIndex]) {
        console.error('Invalid hand index in stand function');
        return;
      }
      
      // Record decision for strategy analysis
      if (dealerHand.length > 0 && playerHands[currentHandIndex]) {
        recordDecision(playerHands[currentHandIndex], dealerHand[0], 'stand');
      }
      
      // Move to next hand if player has split, otherwise dealer plays
      if (currentHandIndex < handsToPlay - 1) {
        setCurrentHandIndex(currentHandIndex + 1);  // Continue to next split hand
      } else {
        dealerPlay();  // All player hands complete, dealer's turn
      }
    } catch (error) {
      console.error('Error in stand function:', error);
    }
  }, [currentHandIndex, handsToPlay, playerHands, dealerHand]);

  // Player doubles down (double bet, take exactly one more card)
  const double = useCallback(() => {
    try {
      // Check if player has enough money to double bet
      if (bankroll < currentBet) return;
      
      // Safety check for valid hand
      if (currentHandIndex >= playerHands.length || !playerHands[currentHandIndex]) {
        console.error('Invalid hand index in double function');
        return;
      }
      
      // // Double the bet amount
      // setBankroll(prev => prev - currentBet);

      // // Update the bet amount for this specific hand (double it)
      // const newHandBets = [...handBets];
      // newHandBets[currentHandIndex] = currentBet * 2; // This hand now has double the bet

      const baseBet = handBets[currentHandIndex] ?? currentBet;
      setBankroll(prev => prev - baseBet);
      const newHandBets = [...handBets];
      newHandBets[currentHandIndex] = baseBet * 2
      setHandBets(newHandBets);
      
      // Take exactly one card and end turn for this hand
      const newDeck = [...deck];
      const newCard = newDeck.pop();
      
      // Safety check for card
      if (!newCard) {
        console.error('Failed to draw card for double');
        return;
      }
      
      const newHands = [...playerHands];
      newHands[currentHandIndex] = [...newHands[currentHandIndex], newCard];
      
      setPlayerHands(newHands);
      setDeck(newDeck);
      
      // Record decision for strategy analysis
      if (dealerHand.length > 0 && playerHands[currentHandIndex]) {
        recordDecision(playerHands[currentHandIndex], dealerHand[0], 'double');
      }
      
      // Move to next hand or end player's turn
      if (currentHandIndex < handsToPlay - 1) {
        setCurrentHandIndex(currentHandIndex + 1);
      } else {
        dealerPlay();
      }
    } catch (error) {
      console.error('Error in double function:', error);
    }
  }, [currentBet, bankroll, deck, playerHands, currentHandIndex, handsToPlay, dealerHand]);

  // Player splits a pair into two separate hands
  const split = useCallback(() => {
    try {
      // Verify split is valid and player has money
      if (!canSplit(playerHands[currentHandIndex]) || bankroll < currentBet) return;
      
      // Safety check for valid hand
      if (currentHandIndex >= playerHands.length || !playerHands[currentHandIndex] || playerHands[currentHandIndex].length !== 2) {
        console.error('Invalid hand for splitting');
        return;
      }
      
      // Deduct additional bet for second hand
      setBankroll(prev => prev - currentBet);

      setHandBets(prev => {
          const next = [...prev];
         // Ensure the current hand has a bet recorded
          next[currentHandIndex] = next[currentHandIndex] ?? currentBet;
         // Add a new bet for the new hand from the split
          next.push(currentBet);
          return next;
       });
      
      // Split the pair into two hands
      const currentHand = playerHands[currentHandIndex];
      const newHands = [...playerHands];
      
      // Create two new hands with one card each
      newHands[currentHandIndex] = [currentHand[0]];  // First card stays in current hand
      newHands.push([currentHand[1]]);                // Second card becomes new hand
      
      setPlayerHands(newHands);
      setHandsToPlay(prev => prev + 1);  // Now playing one additional hand
      
      // Deal second card to current hand (split hands need 2 cards to start)
      const newDeck = [...deck];
      const newCard = newDeck.pop();
      
      // Safety check for card
      if (!newCard) {
        console.error('Failed to draw card for split');
        return;
      }
      
      newHands[currentHandIndex].push(newCard);
      setDeck(newDeck);
      
      // Record decision for strategy analysis
      if (dealerHand.length > 0) {
        recordDecision([currentHand[0]], dealerHand[0], 'split');
      }
    } catch (error) {
      console.error('Error in split function:', error);
    }
  }, [playerHands, currentHandIndex, bankroll, currentBet, canSplit, deck, dealerHand]);

  // Player surrenders (forfeit half bet, end hand immediately)
  const surrender = useCallback(() => {
    try {
      // Only allow surrender on initial 2-card hand if enabled
      if (!surrenderAllowed || !playerHands[currentHandIndex] || playerHands[currentHandIndex].length !== 2) return;
      
      // Return half the bet to player
      setBankroll(prev => prev + Math.floor(currentBet / 2));
      
      // Record decision and end hand
      if (dealerHand.length > 0 && playerHands[currentHandIndex]) {
        recordDecision(playerHands[currentHandIndex], dealerHand[0], 'surrender');
      }
      updateStats('surrender', currentBet, -Math.floor(currentBet / 2));
      
      setGameState('finished');
    } catch (error) {
      console.error('Error in surrender function:', error);
    }
  }, [surrenderAllowed, playerHands, currentHandIndex, currentBet, dealerHand]);

  // ==================== DEALER LOGIC ====================
  /**
   * DEALER AUTOMATION
   * Dealer plays according to fixed house rules.
   * No strategy decisions - must hit/stand based on total.
   */
  
  // Dealer plays automatically according to house rules
  const dealerPlay = useCallback(() => {
    let newDealerHand = [...dealerHand];
    let dealerValue = calculateHandValue(newDealerHand);
    let currentDeck = [...deck];
    
    // Dealer must hit until reaching 17 (or soft 17 based on house rules)
    while (dealerValue < 17 || (dealerValue === 17 && dealerHitsSoft17 && isSoftHand(newDealerHand))) {
      // Stop if deck is empty (shouldn't happen in normal play)
      if (currentDeck.length === 0) break;
      
      const newCard = currentDeck.pop();
      newDealerHand.push(newCard);
      
      dealerValue = calculateHandValue(newDealerHand);
    }
    setDeck(currentDeck);
    setDealerHand(newDealerHand);
    
    // Small delay before finishing hand for dramatic effect
    setTimeout(() => finishHand('dealer_finished'), 1000);
  }, [dealerHand, calculateHandValue, dealerHitsSoft17, isSoftHand, deck]);

  // ==================== HAND COMPLETION LOGIC ====================
  /**
   * END GAME PROCESSING
   * Determines winners and payouts when hand is complete.
   * Updates statistics and handles all money transactions.
   */
  
  // Finish current hand and calculate payouts
  const finishHand = useCallback((reason) => {
    setGameState('finished');
    
    const dealerValue = calculateHandValue(dealerHand);
    let totalWinnings = 0;
    
    // Evaluate each player hand against dealer
    playerHands.forEach((hand, index) => {
      const playerValue = calculateHandValue(hand);
      const handBet = handBets[index] ?? currentBet;
      
      // Determine outcome for this hand
      if (playerValue > 21) {
        // Player busted - automatic loss
        updateStats('loss', handBet, -handBet);
      } else if (dealerValue > 21) {
        // Dealer busted - player wins even money
        const winnings = handBet * 2;
        totalWinnings += winnings;
        updateStats('win', handBet, handBet);
      } else if ((playerValue > dealerValue)) {
        // Player beats dealer - win even money
        const winnings = handBet * 2;
        totalWinnings += winnings;
        updateStats('win', handBet, handBet);
      } else if ((playerValue < dealerValue)) {
        // Dealer beats player - lose bet
        updateStats('loss', handBet, -handBet);
      } else if (playerValue === dealerValue) {
        // Tie (push) - return original bet
        totalWinnings += handBet;
        updateStats('push', handBet, 0);
      }
    });
    
    // Add winnings to bankroll
    setBankroll(prev => Math.max(0, prev + totalWinnings));
  }, [dealerHand, playerHands, currentBet, handBets, calculateHandValue]);

  // ==================== STATISTICS FUNCTIONS ====================
  /**
   * STATISTICS TRACKING SYSTEM
   * Records all game outcomes and decisions for performance analysis.
   * Enables players to see where their strategy needs improvement.
   */
  
  // Update overall game statistics after each hand
  const updateStats = useCallback((result, betAmount, netChange) => {
    setGameStats(prev => ({
      ...prev,
      totalHands: prev.totalHands + 1,
      handsWon: prev.handsWon + (result === 'win' || result === 'blackjack' ? 1 : 0),
      handsLost: prev.handsLost + (result === 'loss' || result === 'bust' ? 1 : 0),
      handsPush: prev.handsPush + (result === 'push' ? 1 : 0),
      totalWagered: prev.totalWagered + betAmount,
      netWinnings: prev.netWinnings + netChange,
      blackjacks: prev.blackjacks + (result === 'blackjack' ? 1 : 0),
      busts: prev.busts + (result === 'bust' ? 1 : 0),
      surrenders: prev.surrenders + (result === 'surrender' ? 1 : 0)
    }));
  }, []);

  // Record individual decisions for detailed strategy analysis
  const recordDecision = useCallback((playerHand, dealerUpCard, action) => {
    // Safety check - ensure we have valid inputs
    if (!dealerUpCard || !playerHand || playerHand.length === 0) return;
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = dealerUpCard.value;
    const isSoft = isSoftHand(playerHand);
    const isPair = playerHand.length === 2 && playerHand[0].rank === playerHand[1].rank;
    
    // Create unique scenario identifier for grouping similar situations
    let scenarioKey;
    if (isPair) {
      scenarioKey = `pair_${playerHand[0].rank}_vs_${dealerUpCard.rank}`;
    } else if (isSoft) {
      scenarioKey = `soft_${playerValue}_vs_${dealerUpCard.rank}`;
    } else {
      scenarioKey = `hard_${playerValue}_vs_${dealerUpCard.rank}`;
    }
    
    // Calculate what the optimal decision should have been
    const optimalAction = getOptimalAction(playerHand, dealerUpCard);
    
    // Create decision record
    const decision = {
      timestamp: Date.now(),
      playerHand: [...playerHand],
      dealerUpCard: { ...dealerUpCard },
      playerValue,
      dealerValue,
      action,
      optimalAction,
      scenarioKey,
      isOptimal: action === optimalAction
    };
    
    // Add to decision history
    setDecisionHistory(prev => [...prev, decision]);
    
    // Update scenario-specific statistics
    setScenarioStats(prev => {
      const scenario = prev[scenarioKey] || {
        count: 0,
        actions: {},
        optimalAction,
        correctDecisions: 0
      };
      
      scenario.count++;
      scenario.actions[action] = (scenario.actions[action] || 0) + 1;
      if (action === optimalAction) scenario.correctDecisions++;
      
      return { ...prev, [scenarioKey]: scenario };
    });
  }, [calculateHandValue, isSoftHand, getOptimalAction]);

  // ==================== DATA PERSISTENCE ====================
  /**
   * SAVE/LOAD SYSTEM
   * Automatically saves all data to browser's localStorage.
   * Includes export/import functionality for backup purposes.
   */
  
  // Save all data to localStorage whenever important state changes
  useEffect(() => {
    const saveData = {
      gameStats,
      decisionHistory,
      scenarioStats,
      bankroll,
      settings: {
        dealerHitsSoft17,
        surrenderAllowed
      }
    };
    localStorage.setItem('blackjackTrainerData', JSON.stringify(saveData));
  }, [gameStats, decisionHistory, scenarioStats, bankroll, dealerHitsSoft17, surrenderAllowed]);

  // Load saved data when component first mounts
  useEffect(() => {
    const savedData = localStorage.getItem('blackjackTrainerData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        if (data.gameStats) setGameStats(data.gameStats);
        if (data.decisionHistory) setDecisionHistory(data.decisionHistory);
        if (data.scenarioStats) setScenarioStats(data.scenarioStats);
        if (data.bankroll) setBankroll(data.bankroll);
        if (data.settings) {
          setDealerHitsSoft17(data.settings.dealerHitsSoft17 ?? true);
          setSurrenderAllowed(data.settings.surrenderAllowed ?? true);
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }
  }, []);

  // Export all statistics to downloadable JSON file
  const exportStats = useCallback(() => {
    const dataToExport = {
      gameStats,
      decisionHistory,
      scenarioStats,
      bankroll,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blackjack-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [gameStats, decisionHistory, scenarioStats, bankroll]);

  // Import statistics from uploaded JSON file
  const importStats = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.gameStats) setGameStats(data.gameStats);
        if (data.decisionHistory) setDecisionHistory(data.decisionHistory);
        if (data.scenarioStats) setScenarioStats(data.scenarioStats);
        if (data.bankroll) setBankroll(data.bankroll);
        alert('Statistics imported successfully!');
      } catch (error) {
        alert('Error importing statistics. Please check the file format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  }, []);

  // ==================== UI HELPER FUNCTIONS ====================
  /**
   * DISPLAY FORMATTING UTILITIES
   * Functions to format numbers and display game information consistently.
   */
  
  // Format money amounts for consistent display
  const formatCurrency = useCallback((amount) => {
    return `$${Math.abs(amount).toLocaleString()}`;
  }, []);

  // Format percentages for statistics display
  const formatPercentage = useCallback((value) => {
    return `${(value * 100).toFixed(1)}%`;
  }, []);

  // ==================== CARD DISPLAY COMPONENT ====================
  /**
   * VISUAL CARD REPRESENTATION
   * Displays individual playing cards with proper colors and styling.
   */
  
  // Component to display a single playing card
  const CardDisplay = ({ card, hidden = false }) => (
    <div className={`inline-block w-16 h-24 rounded-lg border-2 mr-2 mb-2 flex items-center justify-center text-sm font-bold ${
      hidden 
        ? 'bg-blue-600 border-blue-700' 
        : card.suit === '♥' || card.suit === '♦' 
          ? 'bg-white border-red-500 text-red-500' 
          : 'bg-white border-black text-black'
    }`}>
      {hidden ? '?' : (
        <div className="text-center">
          <div>{card.rank}</div>
          <div className="text-lg">{card.suit}</div>
        </div>
      )}
    </div>
  );

  // ==================== MAIN GAME INTERFACE ====================
  /**
   * PRIMARY GAME SCREEN
   * Displays cards, betting controls, and action buttons.
   * This is where players actually play blackjack.
   */
  
  const renderGame = () => (
    <div className="space-y-6">
      {/* BANKROLL AND BETTING DISPLAY */}
      {/* Shows current money and provides quick betting buttons */}
      <div className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
        <div className="text-white">
          <span className="text-lg font-bold">Bankroll: {formatCurrency(bankroll)}</span>
          <span className="ml-4 text-gray-300">Bet: {formatCurrency(currentBet)}</span>
        </div>
        <div className="flex space-x-2">
          {/* Quick bet amount buttons for common denominations */}
          <button 
            onClick={() => setCurrentBet(5)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            disabled={gameState === 'playing'}
          >
            $5
          </button>
          <button 
            onClick={() => setCurrentBet(25)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            disabled={gameState === 'playing'}
          >
            $25
          </button>
          <button 
            onClick={() => setCurrentBet(50)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            disabled={gameState === 'playing'}
          >
            $50
          </button>
          <button 
            onClick={() => setCurrentBet(100)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            disabled={gameState === 'playing'}
          >
            $100
          </button>
        </div>
      </div>

      {/* DEALER HAND SECTION */}
      {/* Shows dealer's cards with hole card hidden during play */}
      <div className="bg-white rounded-lg p-4 border">
        <h3 className="text-lg font-bold mb-3 text-gray-800">Dealer</h3>
        <div className="flex flex-wrap">
          {dealerHand.map((card, index) => (
            <CardDisplay 
              key={index} 
              card={card} 
              hidden={gameState === 'playing' && index === 1} 
            />
          ))}
        </div>
        {/* Show dealer total only when hand is finished */}
        {gameState === 'finished' && (
          <div className="mt-2 text-sm text-gray-600">
            Total: {calculateHandValue(dealerHand)}
          </div>
        )}
      </div>

      {/* PLAYER HAND(S) SECTION */}
      {/* Shows all player hands with current active hand highlighted */}
      <div className="bg-white rounded-lg p-4 border">
        <h3 className="text-lg font-bold mb-3 text-gray-800">Player</h3>
        {playerHands.map((hand, handIndex) => (
          <div key={handIndex} className={`mb-4 p-3 rounded ${handIndex === currentHandIndex && gameState === 'playing' ? 'bg-yellow-100' : ''}`}>
            {/* Show hand number if player has split */}
            {playerHands.length > 1 && (
              <div className="text-sm font-semibold mb-2">Hand {handIndex + 1}</div>
            )}
            <div className="flex flex-wrap">
              {hand.map((card, cardIndex) => (
                <CardDisplay key={cardIndex} card={card} />
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Total: {calculateHandValue(hand)}
              {isSoftHand(hand) && ' (Soft)'}
            </div>
          </div>
        ))}
      </div>

      {/* INSURANCE OFFER */}
      {/* Appears when dealer shows ace */}
      {insuranceOffered && gameState === 'playing' && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
          <p className="text-yellow-800 mb-3">Dealer showing Ace. Insurance available for {formatCurrency(currentBet / 2)}</p>
          <div className="space-x-2">
            <button 
              onClick={() => setInsuranceOffered(false)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Take Insurance
            </button>
            <button 
              onClick={() => setInsuranceOffered(false)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              No Insurance
            </button>
          </div>
        </div>
      )}

      {/* GAME ACTION BUTTONS */}
      {/* Different buttons shown based on current game state */}
      <div className="bg-gray-100 rounded-lg p-4">
        {/* BETTING PHASE - Choose bet amount and deal cards */}
        {gameState === 'betting' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="text-gray-700 font-medium">Bet Amount:</label>
              <input 
                type="number" 
                value={currentBet} 
                onChange={(e) => setCurrentBet(Math.max(5, Math.min(500, parseInt(e.target.value) || 5)))}
                className="border rounded px-3 py-1 w-24"
                min="5"
                max="500"
              />
              <button 
                onClick={startNewHand}
                disabled={bankroll < currentBet}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded font-bold"
              >
                Deal Hand
              </button>
            </div>
            {bankroll < currentBet && (
              <p className="text-red-600 text-sm">Insufficient funds for this bet amount.</p>
            )}
          </div>
        )}

        {/* PLAYING PHASE - Player decision buttons */}
        {gameState === 'playing' && !insuranceOffered && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Hit Button - Take another card */}
            <button 
              onClick={() => hit()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
            >
              Hit
            </button>
            
            {/* Stand Button - End turn */}
            <button 
              onClick={stand}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
            >
              Stand
            </button>
            
            {/* Double Down Button - Double bet, take one card */}
            <button 
              onClick={double}
              disabled={playerHands[currentHandIndex].length !== 2 || bankroll < currentBet}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium"
            >
              Double
            </button>
            
            {/* Split Button - Split matching pairs */}
            <button 
              onClick={split}
              disabled={!canSplit(playerHands[currentHandIndex]) || bankroll < currentBet}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium"
            >
              Split
            </button>
            
            {/* Surrender Button - Forfeit half bet if enabled */}
            {surrenderAllowed && (
              <button 
                onClick={surrender}
                disabled={playerHands[currentHandIndex].length !== 2}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded font-medium col-span-2 md:col-span-1"
              >
                Surrender
              </button>
            )}
          </div>
        )}

        {/* FINISHED PHASE - Start new hand */}
        {gameState === 'finished' && (
          <div className="text-center">
            <button 
              onClick={() => setGameState('betting')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-bold text-lg"
            >
              New Hand
            </button>
          </div>
        )}
      </div>

      {/* LOW FUNDS WARNING */}
      {/* Offer to add practice money when running low */}
      {bankroll < 100 && (
        <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 text-center">
          <p className="text-orange-800 mb-3">Running low on funds?</p>
          <button 
            onClick={() => setBankroll(prev => prev + 500)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
          >
            Add $500 (Practice Money)
          </button>
        </div>
      )}
    </div>
  );

  // ==================== STATISTICS SUMMARY TAB ====================
  /**
   * OVERVIEW STATISTICS DISPLAY
   * Shows high-level performance metrics and key statistics.
   */
  
  const renderStatsSummary = () => {
    const winRate = gameStats.totalHands > 0 ? gameStats.handsWon / gameStats.totalHands : 0;
    const roi = gameStats.totalWagered > 0 ? gameStats.netWinnings / gameStats.totalWagered : 0;
    
    return (
      <div className="space-y-6">
        {/* KEY PERFORMANCE INDICATORS */}
        {/* Three main metrics displayed prominently */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Games Played</h4>
            <p className="text-3xl font-bold text-blue-600">{gameStats.totalHands}</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Win Rate</h4>
            <p className="text-3xl font-bold text-green-600">{formatPercentage(winRate)}</p>
          </div>
          
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Net Winnings</h4>
            <p className={`text-3xl font-bold ${gameStats.netWinnings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {gameStats.netWinnings >= 0 ? '+' : ''}{formatCurrency(gameStats.netWinnings)}
            </p>
          </div>
        </div>

        {/* DETAILED BREAKDOWN */}
        {/* Comprehensive statistics grid */}
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Detailed Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Hands Won:</span>
              <span className="ml-2 font-semibold text-green-600">{gameStats.handsWon}</span>
            </div>
            <div>
              <span className="text-gray-600">Hands Lost:</span>
              <span className="ml-2 font-semibold text-red-600">{gameStats.handsLost}</span>
            </div>
            <div>
              <span className="text-gray-600">Pushes:</span>
              <span className="ml-2 font-semibold text-gray-600">{gameStats.handsPush}</span>
            </div>
            <div>
              <span className="text-gray-600">Blackjacks:</span>
              <span className="ml-2 font-semibold text-yellow-600">{gameStats.blackjacks}</span>
            </div>
            <div>
              <span className="text-gray-600">Busts:</span>
              <span className="ml-2 font-semibold text-red-600">{gameStats.busts}</span>
            </div>
            <div>
              <span className="text-gray-600">Surrenders:</span>
              <span className="ml-2 font-semibold text-gray-600">{gameStats.surrenders}</span>
            </div>
            <div>
              <span className="text-gray-600">Doubles:</span>
              <span className="ml-2 font-semibold text-blue-600">{gameStats.doubles}</span>
            </div>
            <div>
              <span className="text-gray-600">Splits:</span>
              <span className="ml-2 font-semibold text-purple-600">{gameStats.splits}</span>
            </div>
          </div>
        </div>

        {/* FINANCIAL PERFORMANCE */}
        {/* Money-related metrics */}
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Performance Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Return on Investment:</span>
              <span className={`ml-2 font-semibold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercentage(roi)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Wagered:</span>
              <span className="ml-2 font-semibold text-blue-600">{formatCurrency(gameStats.totalWagered)}</span>
            </div>
            <div>
              <span className="text-gray-600">Average Bet:</span>
              <span className="ml-2 font-semibold text-gray-600">
                {gameStats.totalHands > 0 ? formatCurrency(gameStats.totalWagered / gameStats.totalHands) : '$0'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Avg Win/Hand:</span>
              <span className="ml-2 font-semibold text-gray-600">
                {gameStats.totalHands > 0 ? formatCurrency(gameStats.netWinnings / gameStats.totalHands) : '$0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== STRATEGY ANALYSIS TAB ====================
  /**
   * DETAILED STRATEGY PERFORMANCE
   * Shows how well player follows optimal strategy.
   */
  
  const renderStrategyAnalysis = () => {
    const totalDecisions = decisionHistory.length;
    const correctDecisions = decisionHistory.filter(d => d.isOptimal).length;
    const strategyAccuracy = totalDecisions > 0 ? correctDecisions / totalDecisions : 0;
    
    // Group decisions by action type for detailed analysis
    const actionAnalysis = decisionHistory.reduce((acc, decision) => {
      if (!acc[decision.action]) {
        acc[decision.action] = { total: 0, correct: 0 };
      }
      acc[decision.action].total++;
      if (decision.isOptimal) acc[decision.action].correct++;
      return acc;
    }, {});
    
    return (
      <div className="space-y-6">
        {/* OVERALL STRATEGY ACCURACY */}
        {/* High-level accuracy metrics */}
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Strategy Accuracy</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{formatPercentage(strategyAccuracy)}</p>
              <p className="text-gray-600">Overall Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{correctDecisions}</p>
              <p className="text-gray-600">Correct Decisions</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{totalDecisions - correctDecisions}</p>
              <p className="text-gray-600">Mistakes</p>
            </div>
          </div>
        </div>

        {/* ACTION-SPECIFIC ACCURACY */}
        {/* Breakdown by decision type (hit, stand, double, etc.) */}
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Decision Accuracy by Action</h4>
          <div className="space-y-3">
            {Object.entries(actionAnalysis).map(([action, stats]) => {
              const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
              return (
                <div key={action} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-semibold capitalize">{action}</span>
                    <span className="ml-2 text-gray-600">({stats.total} times)</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${accuracy >= 0.8 ? 'text-green-600' : accuracy >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {formatPercentage(accuracy)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {stats.correct}/{stats.total} correct
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RECENT MISTAKES */}
        {/* Learning from recent errors */}
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Recent Strategy Mistakes</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {decisionHistory
              .filter(d => !d.isOptimal)
              .slice(-10)
              .reverse()
              .map((mistake, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="text-sm">
                    <span className="font-semibold">Scenario:</span> {mistake.scenarioKey.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-red-600">Your choice: {mistake.action}</span>
                    <span className="mx-2">→</span>
                    <span className="text-green-600">Optimal: {mistake.optimalAction}</span>
                  </div>
                </div>
              ))
            }
            {decisionHistory.filter(d => !d.isOptimal).length === 0 && (
              <p className="text-gray-600 text-center py-4">No strategy mistakes yet! Keep up the good work.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==================== STRATEGY TABLE TAB ====================
  /**
   * COMPREHENSIVE STRATEGY COMPARISON TABLE
   * Shows optimal strategy vs player decisions in tabular format.
   * This is the new feature requested by the user.
   */
  
  const renderStrategyTable = () => {
    // Create comprehensive strategy table data
    const dealerCards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
    const playerHands = [];
    
    // Hard hands (5-21)
    for (let i = 5; i <= 21; i++) {
      playerHands.push({ type: 'hard', value: i, display: i.toString() });
    }
    
    // Soft hands (A,2 through A,9)
    for (let i = 2; i <= 9; i++) {
      playerHands.push({ type: 'soft', value: i + 11, display: `A,${i}` });
    }
    
    // Pairs
    const pairRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    pairRanks.forEach(rank => {
      playerHands.push({ type: 'pair', value: rank, display: `${rank},${rank}` });
    });
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Complete Strategy Table</h4>
          <p className="text-sm text-gray-600 mb-4">
            Green = Your decision matches optimal strategy | Red = Your decision differs from optimal strategy | Gray = No data yet
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="border px-2 py-1 bg-gray-100">Player Hand</th>
                  {dealerCards.map(card => (
                    <th key={card} className="border px-2 py-1 bg-gray-100 min-w-16">Dealer {card}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerHands.map(hand => (
                  <tr key={`${hand.type}-${hand.value}`}>
                    <td className="border px-2 py-1 font-semibold bg-gray-50">{hand.display}</td>
                    {dealerCards.map(dealerCard => {
                      // Create scenario key to look up statistics
                      let scenarioKey;
                      if (hand.type === 'pair') {
                        scenarioKey = `pair_${hand.value}_vs_${dealerCard}`;
                      } else if (hand.type === 'soft') {
                        scenarioKey = `soft_${hand.value}_vs_${dealerCard}`;
                      } else {
                        scenarioKey = `hard_${hand.value}_vs_${dealerCard}`;
                      }
                      
                      const scenario = scenarioStats[scenarioKey];
                      
                      // Get optimal action for this scenario
                      let optimalAction = 'hit'; // default
                      try {
                        if (hand.type === 'pair') {
                          const mockHand = [{ rank: hand.value, value: hand.value === 'A' ? 11 : hand.value === '10' ? 10 : parseInt(hand.value) || 10 }];
                          mockHand.push(mockHand[0]);
                          const mockDealer = { rank: dealerCard, value: dealerCard === 'A' ? 11 : dealerCard === '10' ? 10 : parseInt(dealerCard) || 10 };
                          optimalAction = getOptimalAction(mockHand, mockDealer);
                        } else if (hand.type === 'soft') {
                          const aceValue = hand.value - 11;
                          const mockHand = [
                            { rank: 'A', value: 11 },
                            { rank: aceValue.toString(), value: aceValue }
                          ];
                          const mockDealer = { rank: dealerCard, value: dealerCard === 'A' ? 11 : dealerCard === '10' ? 10 : parseInt(dealerCard) || 10 };
                          optimalAction = getOptimalAction(mockHand, mockDealer);
                        } else {
                          // Hard hand - create mock cards that sum to the value
                          const mockHand = [
                            { rank: '10', value: 10 },
                            { rank: (hand.value - 10).toString(), value: hand.value - 10 }
                          ];
                          const mockDealer = { rank: dealerCard, value: dealerCard === 'A' ? 11 : dealerCard === '10' ? 10 : parseInt(dealerCard) || 10 };
                          optimalAction = getOptimalAction(mockHand, mockDealer);
                        }
                      } catch (e) {
                        // Fallback if calculation fails
                        optimalAction = 'hit';
                      }
                      
                      // Determine cell content and color
                      let cellContent = '';
                      let cellClass = 'border px-1 py-1 text-center text-xs ';

                      const actionLabel = (action) => {
                        if (action === 'split') return 'P';
                        if (action === 'surrender') return 'R';
                        return action.charAt(0).toUpperCase();
                      };
                      
                      if (!scenario) {
                        // No data yet - show optimal action in gray
                        cellContent = actionLabel(optimalAction);
                        cellClass += 'bg-gray-200 text-gray-600';
                      } else {
                        // Has data - show most common action and accuracy
                        const mostCommonAction = Object.entries(scenario.actions)
                          .sort(([,a], [,b]) => b - a)[0][0];
                        const accuracy = scenario.correctDecisions / scenario.count;
                        
                        cellContent = `${actionLabel(mostCommonAction)} (${Math.round(accuracy * 100)}%)`;
                        
                        if (accuracy >= 0.8) {
                          cellClass += 'bg-green-100 text-green-800';
                        } else if (accuracy >= 0.5) {
                          cellClass += 'bg-yellow-100 text-yellow-800';
                        } else {
                          cellClass += 'bg-red-100 text-red-800';
                        }
                      }
                      
                      return (
                        <td key={dealerCard} className={cellClass} title={`Optimal: ${optimalAction} | Played: ${scenario ? Object.keys(scenario.actions).join(', ') : 'None'}`}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-gray-600">
            <p><strong>Legend:</strong> H=Hit, S=Stand, D=Double, P=Split, R=Surrender</p>
            <p>Percentage shows how often you make the optimal decision in that scenario.</p>
          </div>
        </div>
      </div>
    );
  };

  // ==================== SCENARIO STATISTICS TAB ====================
  /**
   * SCENARIO-BASED PERFORMANCE ANALYSIS
   * Shows performance in specific game situations.
   */
  
  const renderScenarioStats = () => {
    // Sort scenarios by frequency for better display
    const sortedScenarios = Object.entries(scenarioStats)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 20); // Show top 20 most common scenarios
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="text-lg font-bold text-gray-800 mb-4">Most Common Scenarios</h4>
          <div className="text-sm text-gray-600 mb-4">
            Shows your performance in the most frequently encountered situations
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sortedScenarios.map(([scenario, stats]) => {
              const accuracy = stats.count > 0 ? stats.correctDecisions / stats.count : 0;
              const mostCommonAction = Object.entries(stats.actions)
                .sort(([,a], [,b]) => b - a)[0];
              
              return (
                <div key={scenario} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold capitalize">
                        {scenario.replace(/_/g, ' ').replace(/vs/g, 'vs dealer')}
                      </div>
                      <div className="text-sm text-gray-600">
                        Encountered {stats.count} times
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${accuracy >= 0.8 ? 'text-green-600' : accuracy >= 0.6 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatPercentage(accuracy)}
                      </div>
                      <div className="text-xs text-gray-600">accuracy</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Your typical choice:</span>
                      <span className="ml-1 font-semibold capitalize">
                        {mostCommonAction ? mostCommonAction[0] : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Optimal choice:</span>
                      <span className="ml-1 font-semibold text-green-600 capitalize">
                        {stats.optimalAction}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action breakdown */}
                  <div className="mt-2 text-xs">
                    <span className="text-gray-600">Actions taken: </span>
                    {Object.entries(stats.actions).map(([action, count], index) => (
                      <span key={action} className="ml-1">
                        {index > 0 && ', '}
                        <span className={action === stats.optimalAction ? 'text-green-600 font-semibold' : ''}>
                          {action}({count})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ==================== SETTINGS PANEL ====================
  /**
   * CONFIGURATION AND DATA MANAGEMENT
   * Game rules, data export/import, and system settings.
   */
  
  const renderSettings = () => (
    <div className="space-y-6">
      {/* GAME RULES CONFIGURATION */}
      {/* Toggle switches for house rules */}
      <div className="bg-white rounded-lg p-4 border">
        <h4 className="text-lg font-bold text-gray-800 mb-4">Game Rules</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-gray-700">Dealer hits on soft 17</label>
            <button
              onClick={() => setDealerHitsSoft17(!dealerHitsSoft17)}
              className={`w-12 h-6 rounded-full transition-colors ${
                dealerHitsSoft17 ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                dealerHitsSoft17 ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-gray-700">Surrender allowed</label>
            <button
              onClick={() => setSurrenderAllowed(!surrenderAllowed)}
              className={`w-12 h-6 rounded-full transition-colors ${
                surrenderAllowed ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                surrenderAllowed ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* DATA MANAGEMENT TOOLS */}
      {/* Export, import, and reset functionality */}
      <div className="bg-white rounded-lg p-4 border">
        <h4 className="text-lg font-bold text-gray-800 mb-4">Data Management</h4>
        <div className="space-y-4">
          {/* Export Statistics */}
          <div>
            <button
              onClick={exportStats}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              <Download size={16} />
              <span>Export Statistics</span>
            </button>
            <p className="text-sm text-gray-600 mt-1">Download your game data as a JSON file</p>
          </div>
          
          {/* Import Statistics */}
          <div>
            <label className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded cursor-pointer">
              <Upload size={16} />
              <span>Import Statistics</span>
              <input
                type="file"
                accept=".json"
                onChange={importStats}
                className="hidden"
              />
            </label>
            <p className="text-sm text-gray-600 mt-1">Upload a previously exported JSON file</p>
          </div>
          
          {/* Reset All Data */}
          <div>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
                  setGameStats({
                    totalHands: 0,
                    handsWon: 0,
                    handsLost: 0,
                    handsPush: 0,
                    totalWagered: 0,
                    netWinnings: 0,
                    blackjacks: 0,
                    busts: 0,
                    surrenders: 0,
                    doubles: 0,
                    splits: 0,
                    insurances: 0
                  });
                  setDecisionHistory([]);
                  setScenarioStats({});
                  setBankroll(1000);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Reset All Data
            </button>
            <p className="text-sm text-gray-600 mt-1">Permanently delete all statistics and reset bankroll</p>
          </div>
        </div>
      </div>

      {/* ABOUT SECTION */}
      {/* Information about the application */}
      <div className="bg-white rounded-lg p-4 border">
        <h4 className="text-lg font-bold text-gray-800 mb-4">About This Trainer</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            This blackjack trainer helps you learn optimal basic strategy by tracking your decisions 
            and comparing them to mathematically perfect play.
          </p>
          <p>
            The strategy tables are based on computer simulations of millions of hands and represent 
            the best possible decisions for each scenario.
          </p>
          <p>
            All money is virtual and for educational purposes only. Use the statistics to identify 
            areas where your play can be improved.
          </p>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN APPLICATION RENDER ====================
  /**
   * ROOT COMPONENT LAYOUT
   * Combines all sections into the complete application interface.
   */
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-4">
      {/* APPLICATION HEADER */}
      {/* Top navigation and branding */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-white rounded-lg p-4 shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="text-3xl mr-2">♠</span>
            Advanced Blackjack Trainer
          </h1>
          
          {/* MAIN NAVIGATION TABS */}
          {/* Switch between main application sections */}
          <div className="flex space-x-1 mb-4">
            <button
              onClick={() => setActiveView('game')}
              className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                activeView === 'game' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Play size={16} />
              <span>Play Game</span>
            </button>
            
            <button
              onClick={() => setActiveView('stats')}
              className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                activeView === 'stats' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <BarChart3 size={16} />
              <span>Statistics</span>
            </button>
            
            <button
              onClick={() => setActiveView('settings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                activeView === 'settings' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {/* Displays selected section content */}
      <div className="max-w-6xl mx-auto">
        {/* GAME SECTION */}
        {/* Active blackjack gameplay */}
        {activeView === 'game' && (
          <div className="bg-gray-50 rounded-lg p-6 shadow-lg">
            {renderGame()}
          </div>
        )}

        {/* STATISTICS SECTION */}
        {/* Performance analysis and strategy tracking */}
        {activeView === 'stats' && (
          <div className="bg-gray-50 rounded-lg p-6 shadow-lg">
            {/* STATISTICS SUB-NAVIGATION */}
            {/* Tabs within statistics section */}
            <div className="flex space-x-1 mb-6 flex-wrap">
              <button
                onClick={() => setActiveStatsTab('summary')}
                className={`px-4 py-2 rounded transition-colors ${
                  activeStatsTab === 'summary' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Summary
              </button>
              
              <button
                onClick={() => setActiveStatsTab('strategy')}
                className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                  activeStatsTab === 'strategy' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                <TrendingUp size={16} />
                <span>Strategy Analysis</span>
              </button>
              
              <button
                onClick={() => setActiveStatsTab('table')}
                className={`px-4 py-2 rounded transition-colors ${
                  activeStatsTab === 'table' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Strategy Table
              </button>
              
              <button
                onClick={() => setActiveStatsTab('scenarios')}
                className={`px-4 py-2 rounded transition-colors ${
                  activeStatsTab === 'scenarios' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Scenarios
              </button>
            </div>

            {/* STATISTICS CONTENT */}
            {/* Show selected statistics tab */}
            {activeStatsTab === 'summary' && renderStatsSummary()}
            {activeStatsTab === 'strategy' && renderStrategyAnalysis()}
            {activeStatsTab === 'table' && renderStrategyTable()}
            {activeStatsTab === 'scenarios' && renderScenarioStats()}
          </div>
        )}

        {/* SETTINGS SECTION */}
        {/* Configuration and data management */}
        {activeView === 'settings' && (
          <div className="bg-gray-50 rounded-lg p-6 shadow-lg">
            {renderSettings()}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlackjackTrainer;