import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Calendar, Hash, ExternalLink, Copy } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatAddress, copyToClipboard } from '../utils/ticket'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { toast } from 'sonner'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api'

const MyEntries = () => {
  const { t } = useTranslation()
  const { address, isConnected } = useAccount()
  const [registrationData, setRegistrationData] = useState(null)
  const [taskHistory, setTaskHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isConnected && address) {
      loadUserData()
    }
  }, [isConnected, address])

  const loadUserData = async () => {
    setLoading(true)
    try {
      // Load registration data
      const regResponse = await axios.get(`${API}/registration/${address}`)
      if (regResponse.data.success) {
        setRegistrationData(regResponse.data.data)
      }

      // Load task history
      const taskResponse = await axios.get(`${API}/tasks/${address}`)
      if (taskResponse.data.success) {
        setTaskHistory(taskResponse.data.data)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'N/A'
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return 'N/A'
    }
  }

  const handleCopyTicket = async () => {
    if (await copyToClipboard(registrationData.ticket)) {
      toast.success(t('messages.ticketCopied'))
    } else {
      toast.error(t('messages.ticketCopyFailed'))
    }
  }

  const handleCopyTxHash = async () => {
    if (await copyToClipboard(registrationData.txHash)) {
      toast.success(t('messages.txHashCopied'))
    } else {
      toast.error(t('messages.ticketCopyFailed'))
    }
  }

  const openBscScan = () => {
    window.open(`https://bscscan.com/tx/${registrationData.txHash}`, '_blank')
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-white mb-8">{t('myEntries.title')}</h1>
          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardContent className="py-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-squid-grey/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-squid-grey text-3xl">👛</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{t('myEntries.connectRequired')}</h3>
                <p className="text-squid-grey mb-6">{t('myEntries.connectDesc')}</p>
                <ConnectButton />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">{t('myEntries.title')}</h1>
          <p className="text-squid-grey text-lg">
            {t('myEntries.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-squid-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-squid-grey">{t('myEntries.loadingData')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Registration Card - Modern */}
            <div className="relative group animate-fadeIn">
              <div className="absolute -inset-1 bg-gradient-to-r from-squid-ice-blue via-squid-pink to-squid-gold blur-lg opacity-30 group-hover:opacity-50 transition-all duration-700"></div>
              <Card className="relative bg-squid-black/90 border-2 border-squid-ice-blue/40 backdrop-blur-xl">
                <CardHeader className="border-b-2 border-squid-ice-blue/20 bg-gradient-to-r from-squid-ice-blue/5 to-squid-pink/5">
                <CardTitle className="text-white flex items-center space-x-3 font-squid-display text-2xl">
                  <span className="text-3xl animate-squid-pulse">◯</span>
                  <span>{t('myEntries.lotteryRegistration')}</span>
                </CardTitle>
                <CardDescription className="text-squid-light-grey font-squid-body">
                  {t('myEntries.registrationDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrationData ? (
                  <div className="space-y-6">
                    {/* Ticket Display - Modern & Animated */}
                    <div className="relative group">
                      <div className="absolute -inset-2 bg-gradient-to-r from-squid-gold via-squid-pink to-squid-ice-blue blur-xl opacity-40 group-hover:opacity-60 transition-all duration-500 animate-squid-pulse"></div>
                      <div className="relative bg-gradient-to-br from-squid-gold/20 via-squid-pink/20 to-squid-ice-blue/20 border-2 border-squid-gold/50 rounded-2xl p-6 text-center backdrop-blur-xl">
                        <div className="flex items-center justify-center space-x-2 mb-3">
                          <span className="text-2xl animate-squid-bounce">🎫</span>
                          <div className="text-sm font-squid-body text-squid-white font-semibold tracking-wider">
                            {t('myEntries.yourLotteryTicket')}
                          </div>
                        </div>
                        <div className="relative">
                          <div className="text-3xl font-squid-display font-bold text-white mb-4 tracking-wider bg-squid-dark/80 px-6 py-4 rounded-xl border-2 border-squid-gold/30">
                            {registrationData.ticket}
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-r from-squid-gold/20 via-squid-pink/20 to-squid-ice-blue/20 blur-xl -z-10"></div>
                        </div>
                        <Button
                          onClick={handleCopyTicket}
                          className="bg-gradient-to-r from-squid-gold to-squid-orange hover:shadow-[0_0_20px_rgba(255,215,0,0.6)] transition-all duration-300 font-squid-display border-2 border-squid-gold/50"
                          data-testid="copy-ticket-btn"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          {t('myEntries.copyTicket')}
                        </Button>
                      </div>
                    </div>

                    {/* Registration Details */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-squid-dark/30 p-4 rounded-lg border border-squid-grey/20">
                          <div className="text-sm text-squid-ice-blue mb-1 font-medium">{t('myEntries.entryIndex')}</div>
                          <div className="text-white font-bold text-lg">#{registrationData.index}</div>
                        </div>
                        <div className="bg-squid-dark/30 p-4 rounded-lg border border-squid-grey/20">
                          <div className="text-sm text-squid-ice-blue mb-1 font-medium">{t('myEntries.payuReceived')}</div>
                          <div className="text-squid-teal font-bold text-lg">250,000,000 PAYU</div>
                        </div>
                        <div className="bg-squid-dark/30 p-4 rounded-lg border border-squid-grey/20">
                          <div className="text-sm text-squid-ice-blue mb-1 font-medium">{t('myEntries.registrationDate')}</div>
                          <div className="text-white font-bold text-lg">
                            {formatDate(registrationData.createdAt)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="bg-squid-dark/30 p-4 rounded-lg border border-squid-grey/20">
                          <div className="text-sm text-squid-ice-blue mb-2 font-medium">{t('myEntries.transactionHash')}</div>
                          <div className="flex items-center space-x-2">
                            <code className="text-white text-sm bg-squid-black/60 px-3 py-2 rounded border border-squid-grey/30 font-mono">
                              {formatAddress(registrationData.txHash)}
                            </code>
                            <Button
                              onClick={handleCopyTxHash}
                              variant="ghost"
                              size="sm"
                              className="p-2 h-auto hover:bg-squid-grey/20"
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={openBscScan}
                              variant="ghost"
                              size="sm"
                              className="p-1 h-auto"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-squid-grey mb-1">{t('myEntries.walletAddress')}</div>
                          <div className="text-white font-medium font-mono">{formatAddress(address)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-squid-grey mb-1">{t('myEntries.status')}</div>
                          <Badge className="bg-squid-success/20 text-squid-success border-squid-success/30">
                            {t('myEntries.registered')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-squid-grey/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <span className="text-squid-grey text-3xl">🎫</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">{t('myEntries.noRegistration')}</h3>
                    <p className="text-squid-grey mb-6">{t('myEntries.noRegistrationDesc')}</p>
                    <Button
                      onClick={() => window.location.href = '/join'}
                      className="bg-gradient-to-r from-squid-pink to-squid-purple hover:from-squid-pink/80 hover:to-squid-purple/80 text-white"
                    >
                      {t('myEntries.joinTheDraw')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>

            {/* Task History */}
            <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>{t('myEntries.taskHistory')}</span>
                </CardTitle>
                <CardDescription className="text-squid-grey">
                  {t('myEntries.taskHistoryDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {taskHistory.length > 0 ? (
                  <div className="space-y-4">
                    {taskHistory.map((task, index) => (
                      <div key={index} className="flex items-center justify-between py-3 px-4 bg-squid-dark/30 rounded-xl">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-squid-success rounded-full"></div>
                          <div>
                            <div className="text-white font-medium capitalize">
                              {task.platform === 'instagram_story' ? 'Instagram Story' : task.platform}
                            </div>
                            {task.handle && (
                              <div className="text-sm text-squid-grey">@{task.handle}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-squid-grey">
                          {formatDate(task.clickedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-squid-grey/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <span className="text-squid-grey text-3xl">📋</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">{t('myEntries.noTasks')}</h3>
                    <p className="text-squid-grey mb-6">{t('myEntries.noTasksDesc')}</p>
                    <Button
                      onClick={() => window.location.href = '/join'}
                      variant="outline"
                      className="border-squid-teal text-squid-teal hover:bg-squid-teal hover:text-squid-dark"
                    >
                      {t('myEntries.viewTasks')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyEntries