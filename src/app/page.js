"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Share2, Copy, Twitter, Facebook } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function WrappedCard({ card, isActive }) {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center p-6"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.8 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ backgroundColor: card.background_color, color: card.text_color }}
    >
      <div className="text-center max-w-sm relative">
        {/* Background GIF */}
        {card.gif?.gif_url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-20 overflow-hidden rounded-lg">
            <img
              src={card.gif.gif_url}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: 'blur(1px)' }}
            />
          </div>
        )}
        
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: isActive ? 0 : 20, opacity: isActive ? 1 : 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{card.title}</h2>
          {card.subtitle && (
            <p className="text-xl opacity-90 mb-6">{card.subtitle}</p>
          )}
          
          {/* Featured GIF */}
          {card.gif?.gif_url && (
            <div className="mb-6 flex justify-center">
              <div className="relative rounded-lg overflow-hidden shadow-lg max-w-xs">
                <img
                  src={card.gif.gif_url}
                  alt={`GIF for ${card.title}`}
                  className="w-full h-auto max-h-48 object-cover"
                />
              </div>
            </div>
          )}
          
          <p className="text-lg leading-relaxed opacity-95">{card.content}</p>
          {card.stat_value && (
            <div className="mt-8">
              <div className="text-5xl font-black mb-2">{card.stat_value}</div>
            </div>
          )}
          {card.fun_fact && (
            <p className="text-sm opacity-80 mt-6 italic">{card.fun_fact}</p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function ProgressBar({ total, current }) {
  return (
    <div className="flex gap-1 mb-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i <= current ? 'bg-white' : 'bg-white/30'
          }`}
        />
      ))}
    </div>
  );
}

function ShareModal({ isOpen, onClose, result, currentCard }) {
  const [showShareOptions, setShowShareOptions] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}?year=${result?.year}`;
  const shareData = {
    title: `My ${result?.year} Wrapped - When I Was 18`,
    text: `Check out what the world was like when I turned 18 in ${result?.year}! ${result?.tagline}`,
    url: shareUrl,
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled or failed:', err);
      }
    } else {
      setShowShareOptions(true);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Share Your {result?.year} Wrapped</h3>
        
        <div className="space-y-3">
          <Button onClick={handleNativeShare} className="w-full justify-start gap-3">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          
          <Button onClick={handleCopyLink} variant="outline" className="w-full justify-start gap-3">
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>
          
          {!navigator.share && (
            <div className="pt-3 border-t space-y-2">
              <Button onClick={handleTwitterShare} variant="outline" className="w-full justify-start gap-3">
                <Twitter className="w-4 h-4" />
                Share on Twitter
              </Button>
              
              <Button onClick={handleFacebookShare} variant="outline" className="w-full justify-start gap-3">
                <Facebook className="w-4 h-4" />
                Share on Facebook
              </Button>
            </div>
          )}
          
          {showShareOptions && navigator.share && (
            <div className="pt-3 border-t space-y-2">
              <Button onClick={handleTwitterShare} variant="outline" className="w-full justify-start gap-3">
                <Twitter className="w-4 h-4" />
                Share on Twitter
              </Button>
              
              <Button onClick={handleFacebookShare} variant="outline" className="w-full justify-start gap-3">
                <Facebook className="w-4 h-4" />
                Share on Facebook
              </Button>
            </div>
          )}
        </div>
        
        <Button onClick={onClose} variant="ghost" className="w-full mt-4">
          Close
        </Button>
      </div>
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedYear18, setSelectedYear18] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [currentCard, setCurrentCard] = useState(0);
  const [showWrapped, setShowWrapped] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const start = 1930;
    const maxYear = currentYear - 18;
    const list = [];
    for (let y = maxYear; y >= start; y--) list.push(String(y));
    return list;
  }, []);

  // Check for year in URL on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    
    const yearFromUrl = searchParams.get('year');
    if (yearFromUrl && years.includes(yearFromUrl)) {
      setSelectedYear18(yearFromUrl);
      // Auto-generate if year is in URL
      handleSubmitWithYear(yearFromUrl);
    }
    
    // Set video start time to 6 seconds
    const video = document.querySelector('video');
    if (video) {
      const handleLoadedData = () => {
        video.currentTime = 6;
      };
      video.addEventListener('loadeddata', handleLoadedData);
      return () => video.removeEventListener('loadeddata', handleLoadedData);
    }
  }, [searchParams, years]);

  async function handleSubmitWithYear(year) {
    const yearToUse = year || selectedYear18;
    if (!yearToUse) return;

    setLoading(true);
    setError("");
    setResult(null);
    setValidationError("");
    
    // Update URL with year parameter
    const newUrl = `${window.location.pathname}?year=${yearToUse}`;
    window.history.pushState({}, '', newUrl);
    
    console.log("[UI] Submitting request with year18:", yearToUse);
    try {
      const url = `/api/generate?year18=${encodeURIComponent(yearToUse)}`;
      console.log("[UI] Fetching:", url);
      
      // Get stored rate limit token
      const rateLimitToken = localStorage.getItem('rate-limit-token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (rateLimitToken) {
        headers['x-rate-limit-token'] = rateLimitToken;
      }
      
      const res = await fetch(url, { 
        method: "POST",
        headers 
      });
      
      console.log("[UI] Response status:", res.status, res.statusText);
      
      // Store new rate limit token if provided
      const newToken = res.headers.get('x-rate-limit-token');
      if (newToken) {
        localStorage.setItem('rate-limit-token', newToken);
        console.log("[UI] Stored new rate limit token");
      }
      
      if (!res.ok) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData?.error || "";
        } catch {}
        const msg = detail || `Failed to generate (status ${res.status})`;
        console.warn("[UI] Server error:", msg);
        setError(msg);
        return;
      }
      const data = await res.json();
      console.log("[UI] Parsed JSON:", data);
      setResult(data);
      setShowWrapped(true);
      setCurrentCard(0);
    } catch (err) {
      console.error("[UI] Error while generating:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      console.log("[UI] Done generating for year18:", yearToUse);
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (loading) return;
    if (!selectedYear18) {
      setValidationError("Select a year");
      return;
    }
    await handleSubmitWithYear(selectedYear18);
  }

  function nextCard() {
    if (result?.cards && currentCard < result.cards.length - 1) {
      setCurrentCard(prev => prev + 1);
    }
  }

  function prevCard() {
    if (currentCard > 0) {
      setCurrentCard(prev => prev - 1);
    }
  }

  function resetToForm() {
    setShowWrapped(false);
    setResult(null);
    setCurrentCard(0);
    // Clear URL parameter
    window.history.pushState({}, '', window.location.pathname);
  }

  // Auto-advance cards every 7 seconds
  useEffect(() => {
    if (!showWrapped || !result?.cards) return;
    
    const timer = setTimeout(() => {
      if (currentCard < result.cards.length - 1) {
        nextCard();
      }
    }, 7000);

    return () => clearTimeout(timer);
  }, [currentCard, showWrapped, result?.cards]);

  if (showWrapped && result?.cards) {
    const cards = result.cards;
    const currentCardData = cards[currentCard];
    const isLastCard = currentCard === cards.length - 1;

    return (
      <div className="min-h-dvh relative overflow-hidden">
        {/* Current Card Background */}
        <div 
          className="absolute inset-0 transition-colors duration-500"
          style={{ backgroundColor: currentCardData?.background_color || '#000' }}
        />
        
        {/* Progress Bar */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <ProgressBar total={cards.length} current={currentCard} />
        </div>

        {/* Navigation */}
        <div className="absolute top-1/2 left-4 right-4 flex justify-between z-10 pointer-events-none">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevCard}
            disabled={currentCard === 0}
            className="pointer-events-auto text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextCard}
            disabled={currentCard === cards.length - 1}
            className="pointer-events-auto text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        {/* Cards */}
        <div className="relative w-full h-dvh">
          {cards.map((card, index) => (
            <WrappedCard
              key={card.id}
              card={card}
              isActive={index === currentCard}
            />
          ))}
        </div>

        {/* Attribution on last card */}
        {isLastCard && (
          <div className="absolute bottom-16 left-4 right-4 z-10">
            <div className="text-center">
              <a
                href="https://x.com/zedkay22"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/80 hover:text-white text-sm transition-colors duration-200"
              >
                A project by Zalmay Karimi
              </a>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="absolute bottom-6 right-4 flex gap-3 z-10">
          <Button
            variant="ghost"
            onClick={resetToForm}
            className="text-white hover:bg-white/20"
          >
            Try Another Year
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShareModal(true)}
            className="text-white hover:bg-white/20"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Tap zones for mobile */}
        <div className="absolute inset-0 flex">
          <div 
            className="flex-1 cursor-pointer" 
            onClick={prevCard}
          />
          <div 
            className="flex-1 cursor-pointer" 
            onClick={nextCard}
          />
        </div>

        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          result={result}
          currentCard={currentCard}
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6 relative">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/popculture.mp4" type="video/mp4" />
      </video>
      
      {/* Video Overlay */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      
      <div className="w-full max-w-md relative z-10">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-semibold leading-snug">
              What was the world like when you were 18?
            </h1>
          </motion.div>
        </AnimatePresence>

        <Card className="bg-card/90 backdrop-blur border-border shadow-xl">
          <CardHeader />
          <CardContent className="space-y-4">
            <div className="w-full flex items-center justify-center gap-2 text-xl sm:text-2xl text-center">
              <span className="opacity-90">I was 18 in</span>
              <Select value={selectedYear18} onValueChange={(v) => setSelectedYear18(v)}>
                <SelectTrigger className="w-36 bg-transparent border-0 border-b border-border rounded-none px-0 h-auto min-h-0 py-1 shadow-none focus-visible:ring-0 focus-visible:outline-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {validationError ? (
              <p className="text-sm text-destructive text-center" aria-live="polite">{validationError}</p>
            ) : null}

            <Button className="w-full" size="lg" onClick={handleSubmit}>
              {loading ? "Generating..." : "EXPERIENCE THE YEAR"}
            </Button>

            {error ? (
              <p className="text-sm text-destructive text-center">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Attribution on homepage */}
      <div className="absolute bottom-6 left-4 right-4 z-10">
        <div className="text-center">
          <a
            href="https://x.com/zedkay22"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/60 hover:text-foreground text-sm transition-colors duration-200"
          >
            A project by Zalmay Karimi
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
