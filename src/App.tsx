import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Alert, AlertDescription } from './components/ui/alert';
import { CheckCircle, XCircle, Clock, User, Key, Globe } from 'lucide-react';
import { projectId, publicAnonKey } from './utils/supabase/info';

// Initialize Supabase client
const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

interface ValidationStep {
  id: string;
  title: string;
  status: 'pending' | 'success' | 'error' | 'loading';
  description: string;
  details?: string;
  icon: React.ReactNode;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [steps, setSteps] = useState<ValidationStep[]>([
    {
      id: 'supabase-connection',
      title: 'Conexión a Supabase',
      status: 'pending',
      description: 'Verificar conexión con Supabase',
      icon: <Globe className="w-4 h-4" />
    },
    {
      id: 'oauth-config',
      title: 'Configuración OAuth',
      status: 'pending',
      description: 'Verificar configuración de Google OAuth',
      icon: <Key className="w-4 h-4" />
    },
    {
      id: 'google-auth',
      title: 'Autenticación Google',
      status: 'pending',
      description: 'Proceso de autenticación con Google',
      icon: <User className="w-4 h-4" />
    },
    {
      id: 'session-management',
      title: 'Gestión de Sesión',
      status: 'pending',
      description: 'Validar sesión y datos del usuario',
      icon: <CheckCircle className="w-4 h-4" />
    }
  ]);

  useEffect(() => {
    checkSupabaseConnection();
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session);
        setSession(session);
        setUser(session?.user || null);
        
        if (event === 'SIGNED_IN') {
          updateStepStatus('google-auth', 'success', `Usuario autenticado: ${session?.user?.email}`);
          updateStepStatus('session-management', 'success', `Sesión activa con provider: ${session?.user?.app_metadata?.provider}`);
        } else if (event === 'SIGNED_OUT') {
          updateStepStatus('google-auth', 'pending', 'Proceso de autenticación con Google');
          updateStepStatus('session-management', 'pending', 'Validar sesión y datos del usuario');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const updateStepStatus = (id: string, status: ValidationStep['status'], details?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id 
        ? { ...step, status, details }
        : step
    ));
  };

  const checkSupabaseConnection = async () => {
    try {
      updateStepStatus('supabase-connection', 'loading');
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        updateStepStatus('supabase-connection', 'error', `Error: ${error.message}`);
        updateStepStatus('oauth-config', 'error', 'No se puede verificar sin conexión a Supabase');
      } else {
        updateStepStatus('supabase-connection', 'success', 'Conexión establecida correctamente');
        checkOAuthConfig();
      }
    } catch (error) {
      updateStepStatus('supabase-connection', 'error', `Error de conexión: ${error}`);
    }
  };

  const checkOAuthConfig = () => {
    // Verificar si las variables de entorno están configuradas
    if (projectId && publicAnonKey) {
      updateStepStatus('oauth-config', 'success', 'Variables de entorno configuradas. Recuerda configurar Google OAuth en Supabase Dashboard');
    } else {
      updateStepStatus('oauth-config', 'error', 'Variables de entorno faltantes');
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error checking session:', error);
        return;
      }

      if (session) {
        setSession(session);
        setUser(session.user);
        updateStepStatus('google-auth', 'success', `Usuario ya autenticado: ${session.user.email}`);
        updateStepStatus('session-management', 'success', `Sesión activa desde: ${new Date(session.user.created_at).toLocaleString()}`);
      }
    } catch (error) {
      console.error('Error getting session:', error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      updateStepStatus('google-auth', 'loading', 'Iniciando proceso de autenticación...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (error) {
        updateStepStatus('google-auth', 'error', `Error: ${error.message}`);
        updateStepStatus('session-management', 'error', 'No se puede gestionar sesión sin autenticación');
      } else {
        // El callback se manejará en onAuthStateChange
        updateStepStatus('google-auth', 'loading', 'Redirigiendo a Google...');
      }
    } catch (error) {
      updateStepStatus('google-auth', 'error', `Error inesperado: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetValidation = () => {
    setSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending',
      details: undefined
    })));
    checkSupabaseConnection();
  };

  const getStatusIcon = (status: ValidationStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'loading':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ValidationStep['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Exitoso</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'loading':
        return <Badge variant="secondary">Cargando...</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Validación Google OAuth con Supabase
          </h1>
          <p className="text-gray-600">
            Sigue cada paso del proceso de autenticación OAuth
          </p>
        </div>

        <Alert className="mb-6">
          <Globe className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Asegúrate de haber configurado Google OAuth en tu Supabase Dashboard siguiendo las instrucciones en: 
            <a 
              href="https://supabase.com/docs/guides/auth/social-login/auth-google" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline ml-1"
            >
              Supabase Google OAuth Setup
            </a>
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pasos de Validación */}
          <Card>
            <CardHeader>
              <CardTitle>Pasos de Validación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-start space-x-3 p-3 rounded-lg border">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900">
                        {index + 1}. {step.title}
                      </h3>
                      {getStatusBadge(step.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {step.description}
                    </p>
                    {step.details && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {step.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Panel de Control */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Control de Autenticación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!user ? (
                  <Button 
                    onClick={signInWithGoogle} 
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? 'Procesando...' : 'Iniciar Sesión con Google'}
                  </Button>
                ) : (
                  <Button 
                    onClick={signOut} 
                    disabled={isLoading}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? 'Cerrando sesión...' : 'Cerrar Sesión'}
                  </Button>
                )}
                
                <Separator />
                
                <Button 
                  onClick={resetValidation}
                  variant="secondary"
                  className="w-full"
                >
                  Reiniciar Validación
                </Button>
              </CardContent>
            </Card>

            {/* Información del Usuario */}
            {user && (
              <Card>
                <CardHeader>
                  <CardTitle>Información del Usuario</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <span className="text-sm font-medium">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Provider:</span>
                      <span className="text-sm font-medium">{user.app_metadata?.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">ID:</span>
                      <span className="text-sm font-mono text-xs">{user.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Creado:</span>
                      <span className="text-sm">{new Date(user.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Información de Sesión */}
            {session && (
              <Card>
                <CardHeader>
                  <CardTitle>Información de Sesión</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Access Token:</span>
                      <span className="text-xs font-mono bg-gray-100 p-1 rounded max-w-32 truncate">
                        {session.access_token.substring(0, 20)}...
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Expira en:</span>
                      <span className="text-sm">
                        {new Date(session.expires_at * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Token Type:</span>
                      <span className="text-sm font-medium">{session.token_type}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}