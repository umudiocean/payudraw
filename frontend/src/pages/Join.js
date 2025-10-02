import React, { useState, useEffect } from 'react'
import { useAccount, useContractWrite, useWaitForTransaction, useContractRead } from 'wagmi'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, Download, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CONTRACT_ADDRESS, CONTRACT_ABI, REGISTRATION_FEE } from '../config/wagmi'
import { generateTicket, copyToClipboard } from '../utils/ticket'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { decodeEventLog } from 'viem'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api'

const Join = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const [ticket, setTicket] = useState(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [registrationData, setRegistrationData] = useState(null)
  const [showTasks, setShowTasks] = useState(false)
  const [completedTasks, setCompletedTasks] = useState([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false)

  // Contract interactions
  const { write: writeContract, data: txData, isLoading: isPending, error } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'register',
  })
  
  const txHash = txData?.hash
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransaction({
    hash: txHash,
  })

  // Check if user is already registered
  const { data: userIsRegistered, refetch: refetchRegistered } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
    enabled: !!address,
  })

  useEffect(() => {
    if (address && isConnected) {
      // Check both blockchain and backend registration status
      checkRegistrationStatus()
    }
  }, [address, isConnected, userIsRegistered])

  const checkRegistrationStatus = async () => {
    try {
      // First check backend for existing registration
      const response = await axios.get(`${API}/registration/${address}`)
      if (response.data.success && response.data.data) {
        console.log('✅ Found existing registration in backend')
        setIsRegistered(true)
        setRegistrationData(response.data.data)
        setTicket(response.data.data.ticket)
        setShowTasks(true)
        await loadCompletedTasks()
        return
      }
    } catch (error) {
      console.log('No existing registration found in backend')
    }

    // If blockchain says user is registered but backend doesn't have data
    if (userIsRegistered) {
      console.log('✅ User is registered on blockchain but missing backend data')
      setIsRegistered(true)
      // Try to load from backend anyway
      loadUserRegistration()
    }
  }

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
        
        // Load completed tasks
        await loadCompletedTasks()
      }
    } catch (error) {
      console.error('Failed to load registration:', error)
    }
  }

  const loadCompletedTasks = async () => {
    try {
      const response = await axios.get(`${API}/tasks/${address}`)
      if (response.data.success && response.data.data) {
        // Extract unique platforms from completed tasks
        const platforms = [...new Set(response.data.data.map(task => task.platform))]
        setCompletedTasks(platforms)
        console.log('✅ Loaded completed tasks:', platforms)
      }
    } catch (error) {
      console.error('Failed to load completed tasks:', error)
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
      
      // Find the Registered event ABI
      const registeredEventAbi = CONTRACT_ABI.find(item => item.type === 'event' && item.name === 'Registered')
      
      // Parse logs to find Registered event
      const registeredLog = receipt.logs.find(log => 
        log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()
      )
      
      if (registeredLog && registeredEventAbi) {
        try {
          const decodedLog = decodeEventLog({
            abi: [registeredEventAbi],
            data: registeredLog.data,
            topics: registeredLog.topics,
          })
          
          const { user, index, seed, reward, timestamp } = decodedLog.args
          const generatedTicket = generateTicket(seed, Number(index))
          
          // Save to backend
          const saveResponse = await axios.post(`${API}/save-ticket`, {
            wallet: address,
            txHash,
            index: Number(index),
            seed: seed.toString(),
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
            
            // Show success toast with ticket number and PAYU reward
            toast.success(`🎉 Registration Successful!`, {
              duration: 5000,
              description: `Ticket: ${generatedTicket} | 250M PAYU tokens sent! Complete tasks to earn more rewards.`
            })
            setShowRegistrationSuccess(true)
          }
        } catch (decodeError) {
          console.error('Failed to decode event log:', decodeError)
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
        args: [],
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
                  <ConnectButton />
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
                <div className="text-center py-8">
                  <p className="text-squid-grey mb-4">Please go to home page to register for the giveaway.</p>
                  <Button
                    onClick={() => navigate('/')}
                    className="bg-gradient-to-r from-squid-pink to-squid-purple hover:from-squid-pink/80 hover:to-squid-purple/80 text-white font-bold py-3 px-6 rounded-xl"
                  >
                    Go to Home
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
                            // Auto-complete task after opening link
                            setTimeout(() => {
                              handleTaskClick('telegram', '')
                            }, 1000)
                          }}
                          disabled={completedTasks.includes('telegram')}
                          className="w-full bg-gradient-to-r from-squid-gold via-squid-orange to-squid-gold text-squid-black font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform hover:scale-110 hover:shadow-glow-gold hover:-rotate-1 animate-pulse-glow-gold border-2 border-squid-gold/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                          data-testid="telegram-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">◯</span>
                            <span>{completedTasks.includes('telegram') ? 'COMPLETED ✓' : 'ENTER GAME'}</span>
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
                        <p className={`text-sm mb-6 font-squid leading-relaxed ${completedTasks.includes('telegram') ? 'text-squid-light-grey' : 'text-squid-grey'}`}>
                          Retweet our announcement and spread the word about PAYU Giveaway
                        </p>
                        
                        {/* Enhanced Action Button */}
                        <button
                          onClick={() => {
                            if (completedTasks.includes('telegram')) {
                              window.open('https://x.com/payu_coin', '_blank')
                              // Auto-complete task after opening link
                              setTimeout(() => {
                                handleTaskClick('x', '')
                              }, 1000)
                            }
                          }}
                          disabled={!completedTasks.includes('telegram') || completedTasks.includes('x')}
                          className={`w-full font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform border-2 ${
                            completedTasks.includes('telegram') && !completedTasks.includes('x')
                              ? 'bg-gradient-to-r from-squid-ice-blue via-squid-light-blue to-squid-ice-blue text-white hover:scale-110 hover:shadow-glow-ice-blue hover:rotate-1 animate-pulse-glow-blue border-squid-ice-blue/50'
                              : 'bg-squid-grey/20 text-squid-grey border-squid-grey/30 cursor-not-allowed'
                          }`}
                          data-testid="x-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">△</span>
                            <span>
                              {completedTasks.includes('x') ? 'COMPLETED ✓' : 
                               completedTasks.includes('telegram') ? 'ENTER GAME' : 'LOCKED'}
                            </span>
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
                        <p className={`text-sm mb-6 font-squid leading-relaxed ${completedTasks.includes('x') && completedTasks.includes('telegram') ? 'text-squid-light-grey' : 'text-squid-grey'}`}>
                          Share our story and tag your friends in this epic crypto adventure
                        </p>
                        
                        {/* Enhanced Action Button */}
                        <button
                          onClick={() => {
                            if (completedTasks.includes('x') && completedTasks.includes('telegram')) {
                              window.open('https://www.instagram.com/payu.coin/', '_blank')
                              // Auto-complete task after opening link
                              setTimeout(() => {
                                handleTaskClick('instagram_story', '')
                              }, 1000)
                            }
                          }}
                          disabled={!completedTasks.includes('x') || !completedTasks.includes('telegram') || completedTasks.includes('instagram_story')}
                          className={`w-full font-squid-display font-bold py-5 px-8 rounded-2xl transition-all duration-500 transform border-2 ${
                            completedTasks.includes('x') && completedTasks.includes('telegram') && !completedTasks.includes('instagram_story')
                              ? 'bg-gradient-to-r from-squid-pink via-squid-light-pink to-squid-pink text-white hover:scale-110 hover:shadow-glow-pink hover:-rotate-1 animate-pulse-glow-pink border-squid-pink/50'
                              : 'bg-squid-grey/20 text-squid-grey border-squid-grey/30 cursor-not-allowed'
                          }`}
                          data-testid="instagram-task-btn"
                        >
                          <span className="flex items-center justify-center space-x-3">
                            <span className="text-2xl animate-squid-bounce">⬜</span>
                            <span>
                              {completedTasks.includes('instagram_story') ? 'COMPLETED ✓' :
                               completedTasks.includes('x') && completedTasks.includes('telegram') ? 'ENTER GAME' : 'LOCKED'}
                            </span>
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

      {/* Registration Success Modal */}
      {showRegistrationSuccess && ticket && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-squid-black/95 backdrop-blur-xl"
            onClick={() => {
              setShowRegistrationSuccess(false)
              // Tasks will automatically show because isRegistered and showTasks are true
            }}
          >
            {/* Confetti particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    backgroundColor: ['#FFD700', '#FF69B4', '#00BFFF'][Math.floor(Math.random() * 3)],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Modal Content */}
          <div className="relative z-10 max-w-xl w-full animate-scaleIn">
            <div className="bg-gradient-to-br from-squid-black via-squid-black/98 to-squid-black/95 rounded-2xl border-2 border-squid-gold shadow-[0_0_40px_rgba(255,215,0,0.5)] overflow-hidden">
              
              {/* Header */}
              <div className="relative bg-gradient-to-r from-squid-gold/20 via-squid-pink/20 to-squid-ice-blue/20 p-4 border-b-2 border-squid-gold/50">
                <div className="relative text-center">
                  <div className="flex justify-center items-center space-x-2 mb-3">
                    <span className="text-4xl animate-squid-bounce">🎉</span>
                    <span className="text-5xl animate-squid-pulse">🎊</span>
                    <span className="text-4xl animate-squid-bounce" style={{animationDelay: '0.2s'}}>🎉</span>
                  </div>
                  
                  <h2 className="text-3xl font-squid-display font-bold mb-2 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue bg-clip-text text-transparent animate-glow">
                    CONGRATULATIONS!
                  </h2>
                </div>
              </div>

              {/* Main Message */}
              <div className="p-5">
                <div className="text-center space-y-3">
                  
                  {/* Success Icon */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-squid-gold/30 rounded-full blur-2xl animate-squid-pulse"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-squid-gold to-squid-pink rounded-full flex items-center justify-center border-4 border-squid-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.6)] animate-squid-bounce">
                        <CheckCircle className="w-12 h-12 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-3 mb-4">
                    <p className="text-lg font-squid-body text-squid-white font-semibold">
                      Your giveaway ticket is ready!
                    </p>
                    
                    {/* Ticket Display */}
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue blur-xl opacity-50 animate-squid-pulse"></div>
                      <div className="relative bg-gradient-to-r from-squid-gold/20 to-squid-pink/20 border-2 border-squid-gold rounded-xl px-6 py-4 shadow-[0_0_20px_rgba(255,215,0,0.5)]">
                        <p className="text-3xl font-squid-display font-bold bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue bg-clip-text text-transparent animate-glow mb-1">
                          {ticket}
                        </p>
                        <p className="text-xs font-squid-body text-squid-ice-blue font-semibold">
                          YOUR LUCKY TICKET
                        </p>
                      </div>
                    </div>

                    <div className="bg-squid-ice-blue/10 border border-squid-ice-blue/30 rounded-xl p-4 mt-4">
                      <p className="text-base font-squid-body text-squid-light-grey leading-relaxed">
                        We have sent <span className="text-squid-gold font-bold">250 million PAYU coins</span> to your wallet.
                      </p>
                    </div>

                    <div className="bg-squid-pink/10 border border-squid-pink/30 rounded-xl p-4">
                      <p className="text-base font-squid-body text-squid-white font-semibold mb-2">
                        🎯 Complete Other Tasks to Win Rewards!
                      </p>
                      <p className="text-sm font-squid-body text-squid-light-grey">
                        Boost your chances by completing social media tasks below
                      </p>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowRegistrationSuccess(false)
                      // Don't navigate, just show tasks on same page
                      // Tasks section will automatically show because isRegistered = true and showTasks = true
                    }}
                    className="mt-4 px-8 py-3 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue text-white font-squid-display font-bold text-base rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:shadow-[0_0_30px_rgba(255,215,0,0.7)] transform hover:scale-105 transition-all duration-300 border-2 border-squid-gold/50"
                  >
                    <span className="flex items-center space-x-2">
                      <span>VIEW TASKS</span>
                      <span className="text-lg animate-squid-bounce">🎯</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Modal - Shows when all 3 tasks completed */}
      {showCelebration && ticket && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop with confetti effect */}
          <div 
            className="absolute inset-0 bg-squid-black/95 backdrop-blur-xl"
            onClick={() => setShowCelebration(false)}
          >
            {/* Animated background particles */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(50)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-float"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    backgroundColor: ['#00BFFF', '#FF1493', '#FFD700'][Math.floor(Math.random() * 3)],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 3}s`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Modal Content */}
          <div className="relative z-10 max-w-xl w-full animate-scaleIn">
            <div className="bg-gradient-to-br from-squid-black via-squid-black/98 to-squid-black/95 rounded-2xl border-2 border-squid-gold shadow-[0_0_40px_rgba(255,215,0,0.5)] overflow-hidden">
              
              {/* Header with fireworks */}
              <div className="relative bg-gradient-to-r from-squid-gold/20 via-squid-pink/20 to-squid-ice-blue/20 p-4 border-b-2 border-squid-gold/50">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTAiIGN5PSIxMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjE1LDAsMC4xKSIvPjwvc3ZnPg==')] opacity-20"></div>
                
                <div className="relative text-center">
                  {/* Animated emoji burst */}
                  <div className="flex justify-center items-center space-x-2 mb-3">
                    <span className="text-3xl animate-squid-bounce">🎉</span>
                    <span className="text-4xl animate-squid-pulse">🎊</span>
                    <span className="text-3xl animate-squid-bounce" style={{animationDelay: '0.2s'}}>🎉</span>
                  </div>
                  
                  <h2 className="text-3xl font-squid-display font-bold mb-2 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue bg-clip-text text-transparent animate-glow">
                    CONGRATULATIONS!
                  </h2>
                  
                  <div className="flex items-center justify-center space-x-2 text-squid-white text-sm">
                    <span className="text-xl animate-squid-glow-gold">◯</span>
                    <span className="font-squid-display font-bold">ALL TASKS COMPLETED</span>
                    <span className="text-xl animate-squid-glow-blue">⬜</span>
                  </div>
                </div>
              </div>

              {/* Main message with ticket */}
              <div className="p-5">
                <div className="text-center space-y-3">
                  
                  {/* Success Icon */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-squid-gold/30 rounded-full blur-2xl animate-squid-pulse"></div>
                      <div className="relative w-16 h-16 bg-gradient-to-br from-squid-gold to-squid-pink rounded-full flex items-center justify-center border-4 border-squid-gold/50 shadow-[0_0_30px_rgba(255,215,0,0.6)] animate-squid-bounce">
                        <CheckCircle className="w-10 h-10 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  {/* Main Message */}
                  <div className="space-y-2">
                    <p className="text-base font-squid text-squid-light-grey leading-relaxed">
                      You have been added to the giveaway pool with your
                    </p>
                    
                    {/* Ticket Number - Highlighted */}
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue blur-xl opacity-50 animate-squid-pulse"></div>
                      <div className="relative bg-gradient-to-r from-squid-gold/20 to-squid-pink/20 border-2 border-squid-gold rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(255,215,0,0.5)]">
                        <p className="text-2xl font-squid-display font-bold bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue bg-clip-text text-transparent animate-glow mb-1">
                          {ticket}
                        </p>
                        <p className="text-xs font-squid-display text-squid-ice-blue animate-glow-blue">
                          LUCKY TICKET NUMBER
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Extra rewards info */}
                  <div className="bg-gradient-to-r from-squid-ice-blue/10 via-squid-pink/10 to-squid-gold/10 border border-squid-gold/30 rounded-xl p-3 mt-4">
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <span className="text-xl animate-squid-pulse">⚡</span>
                      <span className="text-sm font-squid-display font-bold text-squid-gold animate-glow-gold">
                        BONUS UNLOCKED
                      </span>
                      <span className="text-xl animate-squid-pulse">⚡</span>
                    </div>
                    <p className="text-xs font-squid text-squid-light-grey">
                      +3 Extra Chances Added
                    </p>
                    <div className="flex items-center justify-center space-x-2 mt-2">
                      <span className="text-lg animate-squid-glow-gold">◯</span>
                      <span className="text-lg animate-squid-glow-pink">△</span>
                      <span className="text-lg animate-squid-glow-blue">⬜</span>
                    </div>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setShowCelebration(false)}
                    className="mt-4 px-8 py-3 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue text-white font-squid-display font-bold text-base rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:shadow-[0_0_30px_rgba(255,215,0,0.7)] transform hover:scale-105 transition-all duration-300 border-2 border-squid-gold/50"
                  >
                    <span className="flex items-center space-x-2">
                      <span>CONTINUE</span>
                      <span className="text-lg animate-squid-bounce">🚀</span>
                    </span>
                  </button>

                  {/* Footer note */}
                  <p className="text-xs font-squid text-squid-grey mt-3">
                    Good luck in the giveaway! 🍀
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Join