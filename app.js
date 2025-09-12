// Blackjack with right-panel chip system + smoother animations
(function(){
  // ----- State -----
  let deck = [];
  let playerHand = [];
  let dealerHand = [];
  let bankroll = 500;
  let bet = 10;
  let roundActive = false;
  let holeCardRevealed = false;

  // ----- DOM -----
  const elBankroll = document.getElementById('bankroll');
  const elBankrollTray = document.getElementById('bankroll-tray');
  const elBet = document.getElementById('bet');
  const elDeal = document.getElementById('deal');
  const elHit = document.getElementById('hit');
  const elStand = document.getElementById('stand');
  const elDouble = document.getElementById('double');
  const elNewRound = document.getElementById('new-round');

  const elDealerCards = document.getElementById('dealer-cards');
  const elPlayerCards = document.getElementById('player-cards');
  const elDealerTotal = document.getElementById('dealer-total');
  const elPlayerTotal = document.getElementById('player-total');
  const elMessage = document.getElementById('message');

  const chipButtons = Array.from(document.querySelectorAll('.chip'));

  // ----- Utilities -----
  function createDeck(){
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const suits = ['♠','♥','♦','♣'];
    const newDeck = [];
    for(const suit of suits){
      for(const rank of ranks){
        let value = 0;
        if(rank === 'A') value = 11;
        else if(['J','Q','K'].includes(rank)) value = 10;
        else value = Number(rank);
        newDeck.push({rank, suit, value});
      }
    }
    deck = [...newDeck, ...newDeck, ...newDeck, ...newDeck]; // 4 decks
    shuffle(deck);
  }
  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  function draw(){ if(deck.length < 20) createDeck(); return deck.pop(); }
  function handTotal(hand){
    let sum = 0, aces = 0;
    for(const c of hand){ sum += c.value; if(c.rank === 'A') aces++; }
    while(sum > 21 && aces > 0){ sum -= 10; aces--; }
    return sum;
  }
  const isBlackjack = h => h.length === 2 && handTotal(h) === 21;

  function syncBankrollUI(){
    elBankroll.textContent = bankroll.toString();
    elBankrollTray.textContent = bankroll.toString();
  }

  function render(){
    syncBankrollUI();

    if(document.activeElement !== elBet){ elBet.value = String(bet); }
    elDealerCards.innerHTML = '';
    elPlayerCards.innerHTML = '';

    dealerHand.forEach((card, i)=>{
      const el = renderCard(card);
      if(i === 0 && !holeCardRevealed){ el.classList.add('facedown'); el.innerHTML=''; }
      elDealerCards.appendChild(el);
    });
    playerHand.forEach(card=> elPlayerCards.appendChild(renderCard(card)));

    elDealerTotal.textContent = holeCardRevealed ? handTotal(dealerHand) : '?';
    elPlayerTotal.textContent = handTotal(playerHand);

    elDeal.disabled   = roundActive || bankroll <= 0;
    elHit.disabled    = !roundActive;
    elStand.disabled  = !roundActive;
    elDouble.disabled = !roundActive || playerHand.length !== 2 || bankroll < bet;
    elNewRound.disabled = roundActive;

    // Lock bet controls during a round
    elBet.disabled = roundActive;
    chipButtons.forEach(b=> b.disabled = roundActive);
  }

  function renderCard(card){
    const li = document.createElement('li');
    li.className = 'card ' + ((card.suit==='♥'||card.suit==='♦')?'red':'black');
    li.innerHTML = `
      <span class="rank">${card.rank}</span>
      <span class="suit">${card.suit}</span>
      <span class="rank bottom">${card.rank}</span>
    `;
    return li;
  }
  const setMessage = t => elMessage.textContent = t;

  // ----- Round Flow -----
  function startRound(){
    bet = clampBet(parseInt(elBet.value || '0',10));
    roundActive = true; holeCardRevealed = false;
    playerHand=[]; dealerHand=[];
    playerHand.push(draw()); dealerHand.push(draw()); playerHand.push(draw()); dealerHand.push(draw());

    const playerBJ = isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);
    render();

    if(playerBJ || dealerBJ){
      holeCardRevealed = true;
      resolveOutcome();
      return;
    }
    setMessage('Your move: Hit, Stand, or Double.');
    render();
  }

  function playerHit(){
    if(!roundActive) return;
    playerHand.push(draw());
    if(handTotal(playerHand) > 21){
      holeCardRevealed = true;
      BlackjackFX.payoutToDealer(bet);
      endRound('Bust! You lose.');
    }else{
      setMessage('Hit again or Stand.');
      elDouble.disabled = true;
      render();
    }
  }

  function playerStand(){ if(!roundActive) return; holeCardRevealed = true; dealerPlay(); }

  function playerDouble(){
    if(!roundActive || playerHand.length !== 2) return;
    if(bankroll < bet){ setMessage('Not enough bankroll to double.'); return; }
    bankroll -= bet; bet *= 2; syncBankrollUI();
    BlackjackFX.addToPot(bet/2); // move extra stake into pot & keep it there
    playerHand.push(draw()); render();
    if(handTotal(playerHand) > 21){
      holeCardRevealed = true; BlackjackFX.payoutToDealer(bet); endRound('You busted after doubling.'); return;
    }
    holeCardRevealed = true; dealerPlay();
  }

  function dealerPlay(){
    render();
    while(handTotal(dealerHand) < 17){ dealerHand.push(draw()); }
    resolveOutcome();
  }

  function resolveOutcome(){
    const p = handTotal(playerHand), d = handTotal(dealerHand);

    // immediate BJs
    if(playerHand.length===2 && dealerHand.length===2){
      const pBJ=isBlackjack(playerHand), dBJ=isBlackjack(dealerHand);
      if(pBJ && dBJ){
        bankroll += bet; syncBankrollUI();
        BlackjackFX.refundToPlayer(bet);
        endRound('Push: both have Blackjack.');
        return;
      }
      if(pBJ){
        const total = bet + Math.floor(bet*1.5); // return + payout
        bankroll += total; syncBankrollUI();
        BlackjackFX.payoutToPlayer(total);
        endRound(`Blackjack! You win $${Math.floor(bet*1.5)}.`);
        return;
      }
      if(dBJ){
        BlackjackFX.payoutToDealer(bet);
        endRound('Dealer has Blackjack. You lose.');
        return;
      }
    }

    if(p>21){ BlackjackFX.payoutToDealer(bet); endRound('Bust! You lose.'); return; }
    if(d>21){
      const total = bet*2;
      bankroll += total; syncBankrollUI();
      BlackjackFX.payoutToPlayer(total);
      endRound('Dealer busts. You win!');
      return;
    }

    if(p>d){
      const total = bet*2;
      bankroll += total; syncBankrollUI();
      BlackjackFX.payoutToPlayer(total);
      endRound('You win!');
    } else if(p<d){
      BlackjackFX.payoutToDealer(bet);
      endRound('You lose.');
    } else {
      bankroll += bet; syncBankrollUI();
      BlackjackFX.refundToPlayer(bet);
      endRound('Push. Bet returned.');
    }
  }

  function endRound(msg){
    roundActive = false;
    setMessage(msg);
    render();
  }

  function resetForNextRound(){
    bet = clampBet(parseInt(elBet.value || '10',10));
    setMessage('Place a bet and press Deal to begin.');
    playerHand=[]; dealerHand=[]; holeCardRevealed=false;
    render();
  }

  function clampBet(x){
    if(Number.isNaN(x) || x < 1) return 1;
    if(x > bankroll) return bankroll;
    return x;
  }

  // ----- Events -----
  elDeal?.addEventListener('click', ()=>{
    bet = clampBet(parseInt(elBet.value || '0',10));
    if(bet<=0){ setMessage('Enter a valid bet greater than $0.'); return; }
    if(bet>bankroll){ setMessage('Bet exceeds bankroll.'); return; }
    bankroll -= bet; syncBankrollUI();
    BlackjackFX.resetPot();           // ensure pot is empty
    BlackjackFX.addToPot(bet);        // chips go to pot and stay there
    startRound();
  });
  elHit?.addEventListener('click', playerHit);
  elStand?.addEventListener('click', playerStand);
  elDouble?.addEventListener('click', playerDouble);
  elNewRound?.addEventListener('click', resetForNextRound);

  elBet?.addEventListener('change', ()=>{
    if(roundActive) return; // block edits during round
    bet = clampBet(parseInt(elBet.value || '0',10));
    render();
  });

  chipButtons.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(roundActive) return; // block quick-bets during round
      const amount = parseInt(btn.getAttribute('data-chip')||'0',10);
      bet = clampBet(amount); elBet.value = String(bet);
      render();
    });
  });

  // init
  createDeck();
  setMessage('Place a bet and press Deal to begin.');
  render();
})();

/* ===== Chip system: persistent pot + smooth animations ===== */
const BlackjackFX = (() => {
  const potEl = document.getElementById('pot');
  const playerTray = document.getElementById('player-tray');
  const dealerTray = document.getElementById('dealer-tray');

  const DENOMS = [100, 50, 25, 10, 5, 1];
  const CLASS_BY_DENOM = {1:'denom-1',5:'denom-5',10:'denom-10',25:'denom-25',50:'denom-50',100:'denom-100'};

  let potAmount = 0;
  let potChips = []; // elements currently sitting in the pot

  function center(el){
    const r = el.getBoundingClientRect();
    return {x:r.left + r.width/2, y:r.top + r.height/2};
  }
  function spawnAnimChip(denom, at){
    const chip = document.createElement('div');
    chip.className = `anim-chip ${CLASS_BY_DENOM[denom]||'denom-5'}`;
    chip.textContent = `$${denom}`;
    document.body.appendChild(chip);
    chip.style.left = at.x + 'px';
    chip.style.top  = at.y + 'px';
    return chip;
  }
  function makeRestingChip(denom){
    const c = document.createElement('div');
    c.className = `chip-token ${CLASS_BY_DENOM[denom]||'denom-5'}`;
    c.textContent = `$${denom}`;
    return c;
  }
  function denomBreakdown(amount, maxPerDenom=12){
    let left = Math.max(0, amount|0), out = [];
    for(const d of DENOMS){
      const n = Math.min(maxPerDenom, Math.floor(left/d));
      for(let i=0;i<n;i++) out.push(d);
      left -= n*d;
    }
    if(out.length===0 && amount>0) out.push(1);
    return out;
  }

  function animateMove(el, from, to, opts={}){
    const dist = Math.hypot(to.x-from.x, to.y-from.y);
    const duration = Math.min(1000, Math.max(380, dist*0.8));
    const delay = opts.delay || 0;
    return el.animate(
      [
        { transform:`translate(-50%,-50%) scale(.9)` },
        { transform:`translate(${to.x - from.x - 50}px, ${to.y - from.y - 50}px) scale(1)` }
      ],
      { duration, delay, easing:'cubic-bezier(.22,.7,.18,1)', fill:'forwards' }
    ).finished;
  }

  function settleIntoPot(denom, fromEl){
    const from = center(fromEl);
    const to = center(potEl);
    const chipAnim = spawnAnimChip(denom, from);
    return animateMove(chipAnim, from, to).then(()=>{
      // turn into resting token INSIDE the pot
      const token = makeRestingChip(denom);
      const jitter = () => (Math.random()-.5)*18;
      token.style.left = `calc(50% + ${jitter()}px)`;
      token.style.top  = `calc(50% + ${jitter()}px)`;
      token.style.transform = 'translate(-50%,-50%)';
      potEl.appendChild(token);
      potChips.push(token);
      chipAnim.remove();
    });
  }

  function movePotChipsTo(targetEl){
    const target = center(targetEl);
    const promises = potChips.map((token,i)=>{
      // lift token to page coordinates, then animate
      const r = token.getBoundingClientRect();
      const from = {x: r.left + r.width/2, y: r.top + r.height/2};
      const anim = spawnAnimChip(parseInt(token.textContent.replace('$',''),10), from);
      token.remove(); // remove from pot
      return animateMove(anim, from, target, {delay: i*50}).then(()=>{ anim.remove(); });
    });
    potChips = [];
    potAmount = 0;
    return Promise.all(promises);
  }

  function topUpFromHouse(extraAmount){
    // spawn extra chips at pot center (house matches / blackjack bonus)
    const parts = denomBreakdown(extraAmount);
    const to = center(potEl);
    const promises = parts.map((d,i)=>{
      const chip = spawnAnimChip(d, {x:to.x, y:to.y});
      // quick "pop" in place
      return chip.animate(
        [{transform:'translate(-50%,-50%) scale(.6)', opacity:.0},
         {transform:'translate(-50%,-50%) scale(1)', opacity:1}],
        {duration:200, delay:i*30, easing:'ease-out', fill:'forwards'}
      ).finished.then(()=>{
        const token = makeRestingChip(d);
        const jitter = () => (Math.random()-.5)*18;
        token.style.left = `calc(50% + ${jitter()}px)`;
        token.style.top  = `calc(50% + ${jitter()}px)`;
        token.style.transform = 'translate(-50%,-50%)';
        potEl.appendChild(token);
        potChips.push(token);
        chip.remove();
      });
    });
    potAmount += extraAmount;
    return Promise.all(promises);
  }

  /* ===== Public API ===== */
  return {
    resetPot(){
      potChips.forEach(c=>c.remove());
      potChips = [];
      potAmount = 0;
    },
    addToPot(amount){
      const parts = denomBreakdown(amount);
      potAmount += amount;
      const from = center(playerTray);
      // chain animations slightly staggered
      return Promise.all(parts.map((d,i)=> settleIntoPot(d, playerTray, i*60)));
    },
    payoutToPlayer(totalAmount){
      if(totalAmount > potAmount){
        // add the house's share/bonus to pot first
        topUpFromHouse(totalAmount - potAmount).then(()=> movePotChipsTo(playerTray));
      } else {
        movePotChipsTo(playerTray);
      }
      document.querySelector('.chip-panel')?.classList.add('win-glow');
      setTimeout(()=>document.querySelector('.chip-panel')?.classList.remove('win-glow'), 850);
    },
    refundToPlayer(){ movePotChipsTo(playerTray); },
    payoutToDealer(){ movePotChipsTo(dealerTray);
      document.querySelector('.chip-panel')?.classList.add('loss-pulse');
      setTimeout(()=>document.querySelector('.chip-panel')?.classList.remove('loss-pulse'), 650);
    }
  };
})();
