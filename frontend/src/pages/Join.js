import React, { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEventLogs } from 'viem'
import { toast } from 'sonner'
import { Copy, Download, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import ConnectButton from '../components/ConnectButton'
import { CONTRACT_ADDRESS, CONTRACT_ABI, REGISTRATION_FEE } from '../config/wagmi'
import { generateTicket, copyToClipboard } from '../utils/ticket'
import { useTranslation } from 'react-i18next'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL
const API = `${BACKEND_URL}/api`

const Join = () => {
  const { t } = useTranslation()
  const { address, isConnected } = useAccount()
  const [ticket, setTicket] = useState(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [registrationData, setRegistrationData] = useState(null)
  const [showTasks, setShowTasks] = useState(false)
  const [completedTasks, setCompletedTasks] = useState([])
  const [showCelebration, setShowCelebration] = useState(false)

  // Contract interactions
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Check if user is already registered
  const { data: userIsRegistered, refetch: refetchRegistered } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    enabled: !!address,
  })

  useEffect(() => {
    if (userIsRegistered) {
      setIsRegistered(true)
      // Load existing registration data if available
      loadUserRegistration()
    }
  }, [userIsRegistered, address])

  // Handle successful transaction
  useEffect(() => {
    if (isConfirmed && txHash) {
      handleRegistrationSuccess(txHash)
    }
  }, [isConfirmed, txHash])

  const loadUserRegistration = async () => {
    try {
      const response = await axios.get(`${API}/registration/${address}`)
      if (response.data.success) {
        setRegistrationData(response.data.data)
        setTicket(response.data.data.ticket)
        setShowTasks(true)
      }
    } catch (error) {
      console.error('Failed to load registration:', error)
    }
  }

  const handleRegistrationSuccess = async (txHash) => {
    try {
      // Wait a bit for the transaction to be fully processed
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Parse transaction receipt for events
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })
      
      const logs = parseEventLogs({
        abi: CONTRACT_ABI,
        logs: receipt.logs
      })
      
      const registeredEvent = logs.find(log => log.eventName === 'Registered')
      
      if (registeredEvent) {
        const { user, index, seed, reward, timestamp } = registeredEvent.args
        const generatedTicket = generateTicket(seed, Number(index))
        
        // Save to backend
        const saveResponse = await axios.post(`${API}/save-ticket`, {
          wallet: address,
          txHash,
          index: Number(index),
          seed,
          ticket: generatedTicket,
          reward: reward.toString(),
          timestamp: Number(timestamp)
        })
        
        if (saveResponse.data.success) {
          setTicket(generatedTicket)
          setIsRegistered(true)
          setShowTasks(true)
          setRegistrationData(saveResponse.data.data)
          refetchRegistered()
          
          toast.success(t('messages.registrationSuccess'))
        }
      }
    } catch (error) {
      console.error('Failed to process registration:', error)
      toast.error(t('messages.registrationFailed'))
    }
  }

  const handleRegister = () => {
    if (!isConnected) {
      toast.error(t('messages.connectWallet'))
      return
    }

    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'register',
        value: BigInt(REGISTRATION_FEE)
      })
    } catch (error) {
      console.error('Registration failed:', error)
      toast.error(t('messages.registrationError'))
    }
  }

  const handleCopyTicket = async () => {
    if (await copyToClipboard(ticket)) {
      toast.success(t('messages.ticketCopied'))
    } else {
      toast.error(t('messages.ticketCopyFailed'))
    }
  }

  const handleTaskClick = async (platform, handle = '') => {
    try {
      await axios.post(`${API}/task-click`, {
        wallet: address,
        platform,
        handle
      })
      
      // Add platform to completed tasks if not already present
      setCompletedTasks(prev => {
        if (!prev.includes(platform)) {
          const newTasks = [...prev, platform]
          
          // Check if all 3 tasks are completed
          if (newTasks.length === 3 && ticket) {
            setTimeout(() => {
              setShowCelebration(true)
            }, 500)
          }
          
          return newTasks
        }
        return prev
      })
      
      toast.success(t('messages.taskCompleted', { platform }))
    } catch (error) {
      console.error('Failed to log task:', error)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">{t('join.title')}</h1>
          <p className="text-squid-grey text-lg max-w-2xl mx-auto">
            {t('join.subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Registration Card */}
          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <span>{t('join.registration')}</span>
                {isRegistered && <CheckCircle className="w-5 h-5 text-squid-success" />}
              </CardTitle>
              <CardDescription className="text-squid-grey">
                {isRegistered 
                  ? t('join.alreadyRegistered')
                  : t('join.connectToJoin')
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isConnected ? (
                <div>
                  <p className="text-squid-grey mb-4">{t('join.connectWallet')}</p>
                  <ConnectButton className="w-full" />
                </div>
              ) : isRegistered ? (
                <div className="text-center py-8 relative">
                  {/* Animated Success Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-squid-success/10 to-squid-teal/10 rounded-xl animate-pulse"></div>
                  <div className="relative z-10">
                    <div className="relative">
                      <CheckCircle className="w-20 h-20 text-squid-success mx-auto mb-4 animate-bounce" />
                      <div className="absolute -top-2 -left-2 text-squid-pink text-lg animate-ping">◯</div>
                      <div className="absolute -top-2 -right-2 text-squid-teal text-lg animate-pulse">△</div>
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-squid-purple text-lg animate-bounce">⬜</div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 animate-fade-in">{t('join.alreadyRegisteredTitle')}</h3>
                    <p className="text-squid-grey animate-fade-in">{t('join.alreadyRegisteredDesc')}</p>
                    <div className="mt-4 flex justify-center space-x-2">
                      <span className="text-squid-success animate-pulse">●</span>
                      <span className="text-squid-success animate-pulse" style={{animationDelay: '0.2s'}}>●</span>
                      <span className="text-squid-success animate-pulse" style={{animationDelay: '0.4s'}}>●</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-squid-dark/80 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-medium text-white mb-4">{t('join.registrationDetails')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-squid-grey">{t('join.instantReward')}:</span>
                        <span className="text-squid-teal font-medium">250,000,000 PAYU</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-squid-grey">{t('join.network')}:</span>
                        <span className="text-white font-medium">BSC Mainnet</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleRegister}
                    disabled={isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-squid-pink to-squid-purple hover:from-squid-pink/80 hover:to-squid-purple/80 text-white font-bold py-4 px-6 rounded-2xl shadow-glow transition-all duration-300"
                    data-testid="register-btn"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {isPending ? t('join.confirming') : t('join.processing')}
                      </>
                    ) : (
                      t('join.registerButton')
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ticket Card */}
          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">{t('join.yourTicket')}</CardTitle>
              <CardDescription className="text-squid-grey">
                {ticket ? t('join.ticketGenerated') : t('join.ticketWillAppear')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticket ? (
                <div className="space-y-6">
                  <div className="relative bg-gradient-to-br from-squid-pink/20 to-squid-purple/20 border-2 border-squid-pink/50 rounded-2xl p-8 text-center overflow-hidden">
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="grid grid-cols-6 gap-4 h-full items-center justify-items-center">
                        <div className="text-squid-pink animate-pulse">◯</div>
                        <div className="text-squid-teal animate-pulse" style={{animationDelay: '0.2s'}}>△</div>
                        <div className="text-squid-purple animate-pulse" style={{animationDelay: '0.4s'}}>⬜</div>
                        <div className="text-squid-purple animate-pulse" style={{animationDelay: '0.6s'}}>⬜</div>
                        <div className="text-squid-teal animate-pulse" style={{animationDelay: '0.8s'}}>△</div>
                        <div className="text-squid-pink animate-pulse" style={{animationDelay: '1s'}}>◯</div>
                      </div>
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-center mb-4">
                        <div className="text-squid-pink text-lg animate-pulse mr-2">◯</div>
                        <div className="text-sm text-squid-grey animate-fade-in">{t('join.luckyTicket')}</div>
                        <div className="text-squid-teal text-lg animate-pulse ml-2">△</div>
                      </div>
                      
                      <div className="relative">
                        <div className="text-4xl font-bold text-white mb-6 font-mono animate-glow bg-gradient-to-r from-squid-pink to-squid-purple bg-clip-text text-transparent">
                          {ticket}
                        </div>
                        <div className="absolute -top-2 -left-4 text-squid-purple text-sm animate-bounce">⬜</div>
                        <div className="absolute -top-2 -right-4 text-squid-purple text-sm animate-bounce" style={{animationDelay: '0.5s'}}>⬜</div>
                      </div>
                      
                      <div className="flex space-x-4 justify-center">
                        <Button
                          onClick={handleCopyTicket}
                          variant="outline"
                          size="sm"
                          className="border-squid-teal text-squid-teal hover:bg-squid-teal hover:text-black transition-all duration-300 transform hover:scale-105"
                          data-testid="copy-ticket-btn"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          {t('join.copy')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-squid-purple text-squid-purple hover:bg-squid-purple hover:text-white transition-all duration-300 transform hover:scale-105"
                          data-testid="download-ticket-btn"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t('join.downloadPng')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {registrationData && (
                    <div className="text-xs text-squid-grey space-y-1">
                      <div>Index: #{registrationData.index}</div>
                      {registrationData.txHash && (
                        <div>TX: {registrationData.txHash.slice(0, 10)}...{registrationData.txHash.slice(-8)}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 bg-squid-grey/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-squid-grey text-4xl">🎫</span>
                  </div>
                  <p className="text-squid-grey">{t('join.completeRegistration')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Advanced Squid Game Tasks Section */}
        {showTasks && (
          <div className="mt-12 relative">
            {/* Main Tasks Container */}
            <div className="relative bg-squid-black/80 border-2 border-squid-red/50 rounded-3xl backdrop-blur-2xl overflow-hidden animate-squid-glow">
              
              {/* Dynamic Animated Background Grid */}
              <div className="absolute inset-0 opacity-15">
                <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
                  {[...Array(48)].map((_, i) => (
                    <div key={i} className="border border-squid-red/30 flex items-center justify-center group">
                      <span 
                        className={`text-xs transition-all duration-1000 ${
                          i % 3 === 0 ? 'text-squid-red animate-squid-pulse' :
                          i % 3 === 1 ? 'text-squid-ice-blue animate-squid-bounce' : 
                          'text-squid-gold animate-float'
                        }`} 
                        style={{animationDelay: `${i * 0.05}s`}}
                      >
                        {i % 3 === 0 ? '◯' : i % 3 === 1 ? '△' : '⬜'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Header Section */}
              <div className="relative z-10 p-8 pb-6">
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 bg-gradient-to-r from-squid-red to-squid-pink rounded-full flex items-center justify-center animate-squid-glow border-4 border-squid-light-pink/50">
                      <span className="text-white font-bold text-2xl animate-squid-bounce">◯</span>
                    </div>
                    <h2 className="text-4xl font-squid-display text-white animate-glow bg-gradient-to-r from-squid-red via-squid-pink to-squid-gold bg-clip-text text-transparent">
                      Complete Tasks to Earn Rewards
                    </h2>
                    <div className="w-14 h-14 bg-gradient-to-r from-squid-ice-blue to-squid-light-blue rounded-full flex items-center justify-center animate-squid-glow-blue border-4 border-squid-ice-blue/50">
                      <span className="text-white font-bold text-2xl animate-squid-bounce" style={{animationDelay: '0.3s'}}>△</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <div className="bg-gradient-to-r from-squid-red/30 to-squid-pink/30 border-2 border-squid-red/60 rounded-full px-8 py-3 animate-pulse-glow">
                    <span className="text-squid-light-grey font-squid font-medium text-base flex items-center space-x-2">
                      <span className="text-squid-gold animate-squid-pulse">🎯</span>
                      <span>Sequential Game Unlock System</span>
                      <span className="text-squid-ice-blue animate-squid-bounce">⚡</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sequential Tasks Grid with Advanced Animations */}
              <div className="relative z-10 px-8 pb-8">
                <div className="grid lg:grid-cols-3 gap-8">
                  
                  {/* Task 1: Telegram Circle - Always Active */}
                  <div className="group relative">
                    <div className="absolute -inset-6 bg-gradient-to-r from-squid-gold via-squid-orange to-squid-gold opacity-30 blur-2xl group-hover:opacity-60 transition-all duration-1000 animate-squid-glow-gold"></div>
                    
                    <div className="relative bg-squid-black/95 border-3 border-squid-gold/60 rounded-3xl p-8 backdrop-blur-xl overflow-hidden transform transition-all duration-700 group-hover:scale-110 group-hover:rotate-1 group-hover:border-squid-gold animate-squid-glow-gold">
                      
                      {/* Enhanced Background Pattern */}
                      <div className="absolute inset-0 opacity-8">
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-squid-gold text-8xl animate-squid-pulse">◯</span>
                        </div>
                        {/* Floating mini symbols */}
                        <div className="absolute top-4 left-4 text-squid-gold text-xs animate-float">◯</div>
                        <div className="absolute top-6 right-8 text-squid-gold text-xs animate-squid-bounce">◯</div>
                        <div className="absolute bottom-8 left-6 text-squid-gold text-xs animate-squid-pulse">◯</div>
                      </div>
                      
                      <div className="relative z-10 text-center">
                        {/* Enhanced Game Number */}
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-squid-gold to-squid-orange text-squid-black rounded-full mb-6 font-bold text-lg border-4 border-squid-gold/50 animate-squid-pulse shadow-glow-gold">
                          01
                        </div>
                        
                        {/* Enhanced Game Symbol */}
                        <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-squid-gold/20 to-squid-orange/20 border-4 border-squid-gold rounded-full flex items-center justify-center group-hover:animate-squid-bounce shadow-glow-gold backdrop-blur-sm">
                          <span className="text-squid-gold text-5xl font-bold animate-squid-glow-gold">◯</span>
                        </div>
                        
                        {/* Game Title */}
                        <h3 className="text-2xl font-squid-display text-white mb-4 animate-glow-gold">
                          {t('join.joinTelegram')}
                        </h3>
                        
                        {/* Game Description */}
                        <p className="text-squid-light-grey text-sm mb-8 font-squid leading-relaxed">
                          Join our official Telegram community for latest updates and exclusive content
                        </p>
                        
                        {/* Enhanced Action Button */}
                        <button
                          onClick={() => {
                            window.open('https://t.me/payu_coin', '_blank')
                            handleTaskClick('telegram')
                          }}
                          className="w-full bg-gradient-to-r from-squid-gold via-squid-orange to-squid-gold text-squid-black font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:shadow-glow-gold hover:-rotate-1 animate-pulse-glow-gold border-2 border-squid-gold/50"
                          data-testid="telegram-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">◯</span>
                            <span>ENTER GAME</span>
                            <span className="animate-squid-pulse">⚡</span>
                          </span>
                        </button>
                        
                        {/* Enhanced Reward Info */}
                        <div className="mt-6 flex items-center justify-center space-x-2">
                          <span className="text-squid-gold animate-squid-pulse">✨</span>
                          <span className="text-sm text-squid-gold font-squid animate-glow-gold">+1 EXTRA CHANCE</span>
                          <span className="text-squid-gold animate-squid-pulse">✨</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task 2: X Triangle - Unlocked after Telegram */}
                  <div className={`group relative transition-all duration-1000 ${completedTasks.includes('telegram') ? '' : 'opacity-40 pointer-events-none'}`}>
                    <div className={`absolute -inset-6 bg-gradient-to-r from-squid-ice-blue via-squid-light-blue to-squid-ice-blue blur-2xl transition-all duration-1000 ${completedTasks.includes('telegram') ? 'opacity-30 group-hover:opacity-60 animate-squid-glow-blue' : 'opacity-10'}`}></div>
                    
                    <div className={`relative bg-squid-black/95 rounded-3xl p-8 backdrop-blur-xl overflow-hidden transform transition-all duration-700 ${completedTasks.includes('telegram') ? 'border-3 border-squid-ice-blue/60 group-hover:scale-110 group-hover:-rotate-1 group-hover:border-squid-ice-blue animate-squid-glow-blue' : 'border-2 border-squid-grey/30'}`}>
                      
                      {/* Lock overlay for disabled state */}
                      {!completedTasks.includes('telegram') && (
                        <div className="absolute inset-0 bg-squid-black/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-3xl">
                          <div className="text-center">
                            <div className="text-6xl mb-4 animate-squid-pulse">🔒</div>
                            <p className="text-squid-grey font-squid text-sm">Complete Telegram Task First</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Enhanced Background Pattern */}
                      <div className="absolute inset-0 opacity-8">
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-squid-ice-blue text-8xl animate-squid-bounce">△</span>
                        </div>
                        <div className="absolute top-4 left-4 text-squid-ice-blue text-xs animate-float">△</div>
                        <div className="absolute top-6 right-8 text-squid-ice-blue text-xs animate-squid-bounce">△</div>
                        <div className="absolute bottom-8 left-6 text-squid-ice-blue text-xs animate-squid-pulse">△</div>
                      </div>
                      
                      <div className="relative z-10 text-center">
                        {/* Enhanced Game Number */}
                        <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-squid-ice-blue to-squid-light-blue text-white rounded-full mb-6 font-bold text-lg border-4 shadow-glow-ice-blue ${completedTasks.includes('telegram') ? 'border-squid-ice-blue/50 animate-squid-pulse' : 'border-squid-grey/30'}`}>
                          02
                        </div>
                        
                        {/* Enhanced Game Symbol */}
                        <div className={`w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-squid-ice-blue/20 to-squid-light-blue/20 border-4 flex items-center justify-center shadow-glow-ice-blue backdrop-blur-sm ${completedTasks.includes('telegram') ? 'border-squid-ice-blue group-hover:animate-squid-bounce' : 'border-squid-grey/30'}`} style={{clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'}}>
                          <span className={`text-5xl font-bold ${completedTasks.includes('telegram') ? 'text-squid-ice-blue animate-squid-glow-blue' : 'text-squid-grey'}`}>△</span>
                        </div>
                        
                        {/* Game Title */}
                        <h3 className={`text-2xl font-squid-display mb-4 ${completedTasks.includes('telegram') ? 'text-white animate-glow-blue' : 'text-squid-grey'}`}>
                          {t('join.retweetX')}
                        </h3>
                        
                        {/* Game Description */}
                        <p className={`text-sm mb-8 font-squid leading-relaxed ${completedTasks.includes('telegram') ? 'text-squid-light-grey' : 'text-squid-grey'}`}>
                          Retweet our announcement and spread the word about PAYU Draw
                        </p>
                        
                        {/* Enhanced Action Button */}
                        <button
                          onClick={() => {
                            if (completedTasks.includes('telegram')) {
                              window.open('https://x.com/payu_coin', '_blank')
                              handleTaskClick('x')
                            }
                          }}
                          disabled={!completedTasks.includes('telegram')}
                          className={`w-full font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform border-2 ${
                            completedTasks.includes('telegram')
                              ? 'bg-gradient-to-r from-squid-ice-blue via-squid-light-blue to-squid-ice-blue text-white hover:scale-110 hover:shadow-glow-ice-blue hover:rotate-1 animate-pulse-glow-blue border-squid-ice-blue/50'
                              : 'bg-squid-grey/20 text-squid-grey border-squid-grey/30 cursor-not-allowed'
                          }`}
                          data-testid="x-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">△</span>
                            <span>{completedTasks.includes('telegram') ? 'ENTER GAME' : 'LOCKED'}</span>
                            <span className="animate-squid-pulse">{completedTasks.includes('telegram') ? '⚡' : '🔒'}</span>
                          </span>
                        </button>
                        
                        {/* Enhanced Reward Info */}
                        <div className="mt-6 flex items-center justify-center space-x-2">
                          <span className={completedTasks.includes('telegram') ? 'text-squid-ice-blue animate-squid-pulse' : 'text-squid-grey'}>✨</span>
                          <span className={`text-sm font-squid ${completedTasks.includes('telegram') ? 'text-squid-ice-blue animate-glow-blue' : 'text-squid-grey'}`}>+1 EXTRA CHANCE</span>
                          <span className={completedTasks.includes('telegram') ? 'text-squid-ice-blue animate-squid-pulse' : 'text-squid-grey'}>✨</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task 3: Instagram Square - Unlocked after X */}
                  <div className={`group relative transition-all duration-1000 ${completedTasks.includes('x') && completedTasks.includes('telegram') ? '' : 'opacity-40 pointer-events-none'}`}>
                    <div className={`absolute -inset-6 bg-gradient-to-r from-squid-pink via-squid-light-pink to-squid-pink blur-2xl transition-all duration-1000 ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'opacity-30 group-hover:opacity-60 animate-squid-glow-pink' : 'opacity-10'}`}></div>
                    
                    <div className={`relative bg-squid-black/95 rounded-3xl p-8 backdrop-blur-xl overflow-hidden transform transition-all duration-700 ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'border-3 border-squid-pink/60 group-hover:scale-110 group-hover:rotate-1 group-hover:border-squid-pink animate-squid-glow-pink' : 'border-2 border-squid-grey/30'}`}>
                      
                      {/* Lock overlay for disabled state */}
                      {(!completedTasks.includes('x') || !completedTasks.includes('telegram')) && (
                        <div className="absolute inset-0 bg-squid-black/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-3xl">
                          <div className="text-center">
                            <div className="text-6xl mb-4 animate-squid-pulse">🔒</div>
                            <p className="text-squid-grey font-squid text-sm">Complete Previous Tasks First</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Enhanced Background Pattern */}
                      <div className="absolute inset-0 opacity-8">
                        <div className="h-full w-full flex items-center justify-center">
                          <span className="text-squid-pink text-8xl animate-float">⬜</span>
                        </div>
                        <div className="absolute top-4 left-4 text-squid-pink text-xs animate-float">⬜</div>
                        <div className="absolute top-6 right-8 text-squid-pink text-xs animate-squid-bounce">⬜</div>
                        <div className="absolute bottom-8 left-6 text-squid-pink text-xs animate-squid-pulse">⬜</div>
                      </div>
                      
                      <div className="relative z-10 text-center">
                        {/* Enhanced Game Number */}
                        <div className={`inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-squid-pink to-squid-light-pink text-white rounded-full mb-6 font-bold text-lg border-4 shadow-glow-pink ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'border-squid-pink/50 animate-squid-pulse' : 'border-squid-grey/30'}`}>
                          03
                        </div>
                        
                        {/* Enhanced Game Symbol */}
                        <div className={`w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-squid-pink/20 to-squid-light-pink/20 border-4 rounded-2xl flex items-center justify-center shadow-glow-pink backdrop-blur-sm ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'border-squid-pink group-hover:animate-squid-bounce' : 'border-squid-grey/30'}`}>
                          <span className={`text-5xl font-bold ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-pink animate-squid-glow-pink' : 'text-squid-grey'}`}>⬜</span>
                        </div>
                        
                        {/* Game Title */}
                        <h3 className={`text-2xl font-squid-display mb-4 ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-white animate-glow-pink' : 'text-squid-grey'}`}>
                          {t('join.shareInstagram')}
                        </h3>
                        
                        {/* Game Description */}
                        <p className={`text-sm mb-8 font-squid leading-relaxed ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-light-grey' : 'text-squid-grey'}`}>
                          Share our story and tag your friends in this epic crypto adventure
                        </p>
                        
                        {/* Enhanced Action Button */}
                        <button
                          onClick={() => {
                            if (completedTasks.includes('x') && completedTasks.includes('telegram')) {
                              window.open('https://www.instagram.com/payu.coin/', '_blank')
                              handleTaskClick('instagram_story')
                            }
                          }}
                          disabled={!completedTasks.includes('x') || !completedTasks.includes('telegram')}
                          className={`w-full font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform border-2 ${
                            completedTasks.includes('x') && completedTasks.includes('telegram')
                              ? 'bg-gradient-to-r from-squid-pink via-squid-light-pink to-squid-pink text-white hover:scale-110 hover:shadow-glow-pink hover:-rotate-1 animate-pulse-glow-pink border-squid-pink/50'
                              : 'bg-squid-grey/20 text-squid-grey border-squid-grey/30 cursor-not-allowed'
                          }`}
                          data-testid="instagram-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">⬜</span>
                            <span>{completedTasks.includes('x') && completedTasks.includes('telegram') ? 'ENTER GAME' : 'LOCKED'}</span>
                            <span className="animate-squid-pulse">{completedTasks.includes('x') && completedTasks.includes('telegram') ? '⚡' : '🔒'}</span>
                          </span>
                        </button>
                        
                        {/* Enhanced Reward Info */}
                        <div className="mt-6 flex items-center justify-center space-x-2">
                          <span className={completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-pink animate-squid-pulse' : 'text-squid-grey'}>✨</span>
                          <span className={`text-sm font-squid ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-pink animate-glow-pink' : 'text-squid-grey'}`}>+1 EXTRA CHANCE</span>
                          <span className={completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-pink animate-squid-pulse' : 'text-squid-grey'}>✨</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Bottom Section */}
              <div className="relative z-10 p-8 pt-6 border-t-2 border-gradient-to-r from-squid-red via-squid-ice-blue to-squid-gold">
                <div className="text-center">
                  
                  {/* Animated Progress Indicator */}
                  <div className="flex items-center justify-center space-x-8 mb-8">
                    <div className="flex space-x-3">
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('telegram') ? 'text-squid-gold animate-squid-glow-gold' : 'text-squid-grey animate-pulse'}`}>●</span>
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('x') ? 'text-squid-ice-blue animate-squid-glow-blue' : 'text-squid-grey animate-pulse'}`} style={{animationDelay: '0.2s'}}>▲</span>
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('instagram_story') ? 'text-squid-pink animate-squid-glow-pink' : 'text-squid-grey animate-pulse'}`} style={{animationDelay: '0.4s'}}>■</span>
                    </div>
                    
                    <div className="px-6 py-2 bg-gradient-to-r from-squid-black/60 to-squid-black/80 border border-squid-red/40 rounded-xl backdrop-blur-sm">
                      <span className="text-squid-light-grey font-squid text-base animate-glow">
                        Complete All Games to Maximize Rewards
                      </span>
                    </div>
                    
                    <div className="flex space-x-3">
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('instagram_story') ? 'text-squid-pink animate-squid-glow-pink' : 'text-squid-grey animate-pulse'}`} style={{animationDelay: '0.6s'}}>■</span>
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('x') ? 'text-squid-ice-blue animate-squid-glow-blue' : 'text-squid-grey animate-pulse'}`} style={{animationDelay: '0.8s'}}>▲</span>
                      <span className={`text-2xl transition-all duration-500 ${completedTasks.includes('telegram') ? 'text-squid-gold animate-squid-glow-gold' : 'text-squid-grey animate-pulse'}`} style={{animationDelay: '1s'}}>●</span>
                    </div>
                  </div>
                  
                  {/* Enhanced Progress Counter */}
                  <div className="relative inline-block">
                    <div className={`absolute -inset-2 blur-xl rounded-full transition-all duration-1000 ${
                      completedTasks.length === 3 ? 'bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue opacity-60 animate-squid-pulse' :
                      completedTasks.length === 2 ? 'bg-gradient-to-r from-squid-ice-blue to-squid-pink opacity-40' :
                      completedTasks.length === 1 ? 'bg-squid-gold/30' : 'bg-squid-grey/20'
                    }`}></div>
                    
                    <div className={`relative inline-flex items-center space-x-4 px-8 py-4 rounded-2xl border-2 backdrop-blur-xl transition-all duration-1000 ${
                      completedTasks.length === 3 ? 'bg-gradient-to-r from-squid-gold/20 via-squid-pink/20 to-squid-ice-blue/20 border-squid-gold animate-pulse-glow-gold' :
                      completedTasks.length === 2 ? 'bg-gradient-to-r from-squid-ice-blue/20 to-squid-pink/20 border-squid-ice-blue' :
                      completedTasks.length === 1 ? 'bg-squid-gold/20 border-squid-gold' : 'bg-squid-grey/10 border-squid-grey'
                    }`}>
                      
                      <span className={`text-lg font-squid transition-all duration-500 ${
                        completedTasks.length === 3 ? 'text-squid-gold animate-squid-pulse' :
                        completedTasks.length >= 1 ? 'text-squid-gold animate-squid-pulse' : 'text-squid-grey'
                      }`}>◯</span>
                      
                      <div className="text-center">
                        <div className={`text-2xl font-squid-display font-bold transition-all duration-500 ${
                          completedTasks.length === 3 ? 'text-squid-gold animate-glow-gold' :
                          completedTasks.length >= 1 ? 'text-squid-ice-blue animate-glow-blue' : 'text-squid-grey'
                        }`}>
                          {completedTasks.length}/3
                        </div>
                        <div className="text-xs text-squid-light-grey font-squid">
                          GAMES COMPLETED
                        </div>
                      </div>
                      
                      <span className={`text-lg font-squid transition-all duration-500 ${
                        completedTasks.length === 3 ? 'text-squid-pink animate-squid-pulse' :
                        completedTasks.length >= 2 ? 'text-squid-pink animate-squid-pulse' : 'text-squid-grey'
                      }`}>△</span>
                    </div>
                  </div>
                  
                  {/* Completion Bonus Message */}
                  {completedTasks.length === 3 && (
                    <div className="mt-6 animate-fade-in">
                      <div className="inline-flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-squid-gold/30 via-squid-pink/30 to-squid-ice-blue/30 border-2 border-squid-gold rounded-full animate-pulse-glow-gold">
                        <span className="text-squid-gold animate-squid-pulse">🏆</span>
                        <span className="text-squid-light-grey font-squid font-bold">ALL GAMES COMPLETED! MAXIMUM REWARDS UNLOCKED!</span>
                        <span className="text-squid-pink animate-squid-bounce">🎉</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Join