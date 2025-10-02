import React, { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Download, Users, Activity, Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import axios from 'axios'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ''
const API = BACKEND_URL ? `${BACKEND_URL}/api` : '/api'
const ADMIN_WALLET = '0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a'

const Admin = () => {
  const { t } = useTranslation()
  const { address, isConnected } = useAccount()
  const { signMessage } = useSignMessage()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [registrations, setRegistrations] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    totalTasks: 0,
    totalRewards: 0
  })

  const isAdmin = isConnected && address?.toLowerCase() === ADMIN_WALLET.toLowerCase()
  
  console.log('🔍 Admin Page Loaded')
  console.log('Connected:', isConnected)
  console.log('Address:', address)
  console.log('Is Admin:', isAdmin)
  console.log('Admin Wallet:', ADMIN_WALLET)

  useEffect(() => {
    console.log('Admin Check:', { isConnected, address, isAdmin, ADMIN_WALLET })
  }, [isConnected, address, isAdmin])

  useEffect(() => {
    if (isAdmin && isAuthenticated) {
      loadData()
    }
  }, [isAdmin, isAuthenticated])

  const handleAuthenticate = async () => {
    if (!isAdmin) {
      toast.error(t('admin.accessDenied'))
      return
    }

    try {
      const message = `Admin authentication for PAYU Giveaway\nTimestamp: ${Date.now()}`
      await signMessage({ message })
      setIsAuthenticated(true)
      toast.success(t('messages.authSuccess'))
    } catch (error) {
      toast.error(t('messages.authFailed'))
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const headers = {
        'X-Wallet-Address': address
      }
      
      const [regResponse, taskResponse] = await Promise.all([
        axios.get(`${API}/admin/registrations`, { headers }),
        axios.get(`${API}/admin/tasks`, { headers })
      ])

      if (regResponse.data.success) {
        setRegistrations(regResponse.data.data)
        setStats(prev => ({
          ...prev,
          totalRegistrations: regResponse.data.data.length,
          totalRewards: regResponse.data.data.length * 250000000
        }))
      }

      if (taskResponse.data.success) {
        setTasks(taskResponse.data.data)
        setStats(prev => ({
          ...prev,
          totalTasks: taskResponse.data.data.length
        }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error(t('messages.dataLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error(t('messages.noDataToExport'))
      return
    }

    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(item => Object.values(item).join(','))
    const csv = [headers, ...rows].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success(t('messages.csvExported', { filename }))
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 text-squid-grey mx-auto mb-6" />
            <h3 className="text-xl font-bold text-white mb-4">{t('admin.accessRequired')}</h3>
            <p className="text-squid-grey mb-6">{t('admin.connectForAdmin')}</p>
            <Button 
              onClick={() => window.location.href = '/join'}
              className="bg-gradient-to-r from-squid-pink to-squid-purple"
            >
              {t('hero.connectButton')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 text-squid-error mx-auto mb-6" />
            <h3 className="text-xl font-bold text-white mb-4">{t('admin.accessDenied')}</h3>
            <p className="text-squid-grey mb-6">
              {t('admin.accessDeniedDesc')}
            </p>
            <p className="text-xs text-squid-grey font-mono">{address}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 text-squid-teal mx-auto mb-6" />
            <h3 className="text-xl font-bold text-white mb-4">{t('admin.authentication')}</h3>
            <p className="text-squid-grey mb-6">
              {t('admin.authDesc')}
            </p>
            <Button 
              onClick={handleAuthenticate}
              className="bg-gradient-to-r from-squid-teal to-squid-purple"
            >
              {t('admin.authenticate')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">{t('admin.title')}</h1>
          <p className="text-squid-grey text-lg">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-squid-grey text-sm">{t('admin.totalRegistrations')}</p>
                  <p className="text-3xl font-bold text-white">{stats.totalRegistrations}</p>
                </div>
                <Users className="w-8 h-8 text-squid-pink" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-squid-grey text-sm">{t('admin.taskCompletions')}</p>
                  <p className="text-3xl font-bold text-white">{stats.totalTasks}</p>
                </div>
                <Activity className="w-8 h-8 text-squid-teal" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-squid-grey text-sm">{t('admin.payuDistributed')}</p>
                  <p className="text-3xl font-bold text-white">{(stats.totalRewards / 1000000).toFixed(0)}M</p>
                </div>
                <div className="w-8 h-8 bg-squid-purple/20 rounded-lg flex items-center justify-center">
                  <span className="text-squid-purple font-bold">P</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registrations Table */}
        <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">{t('admin.registrations')}</CardTitle>
              <Button
                onClick={() => exportCSV(registrations, 'registrations.csv')}
                variant="outline"
                size="sm"
                className="border-squid-teal text-squid-teal hover:bg-squid-teal hover:text-squid-dark"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('admin.exportCsv')}
              </Button>
            </div>
            <CardDescription className="text-squid-grey">
              {t('admin.registrationsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-squid-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-squid-grey">{t('admin.loadingRegistrations')}</p>
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-squid-grey">{t('admin.noRegistrationsFound')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-squid-grey/20">
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.wallet')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.index')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.ticket')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.txHash')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg, index) => (
                      <tr key={index} className="border-b border-squid-grey/10">
                        <td className="py-3 px-4 text-white font-mono text-xs">
                          {reg.wallet?.slice(0, 6)}...{reg.wallet?.slice(-4)}
                        </td>
                        <td className="py-3 px-4 text-white">#{reg.index}</td>
                        <td className="py-3 px-4 text-squid-teal font-mono">{reg.ticket}</td>
                        <td className="py-3 px-4 text-squid-grey font-mono text-xs">
                          {reg.tx_hash?.slice(0, 10)}...
                        </td>
                        <td className="py-3 px-4 text-squid-grey">
                          {new Date(reg.created_at || reg.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="bg-black/50 border-squid-grey/20 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">{t('admin.taskCompletionsTitle')}</CardTitle>
              <Button
                onClick={() => exportCSV(tasks, 'task_completions.csv')}
                variant="outline"
                size="sm"
                className="border-squid-purple text-squid-purple hover:bg-squid-purple hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('admin.exportCsv')}
              </Button>
            </div>
            <CardDescription className="text-squid-grey">
              {t('admin.taskCompletionsDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-squid-pink border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-squid-grey">{t('admin.loadingTasks')}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-squid-grey">{t('admin.noTasksFound')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-squid-grey/20">
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.wallet')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.platform')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.handle')}</th>
                      <th className="text-left py-3 px-4 text-squid-grey">{t('admin.completed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, index) => (
                      <tr key={index} className="border-b border-squid-grey/10">
                        <td className="py-3 px-4 text-white font-mono text-xs">
                          {task.user_id?.slice(0, 6)}...{task.user_id?.slice(-4)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-squid-pink/20 text-squid-pink border-squid-pink/30">
                            {task.platform}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-squid-grey">
                          {task.handle || '-'}
                        </td>
                        <td className="py-3 px-4 text-squid-grey">
                          {new Date(task.clicked_at || task.clickedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Admin