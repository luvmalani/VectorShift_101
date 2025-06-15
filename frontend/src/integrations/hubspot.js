//hubspot.js

import React, { useState, useEffect } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import axios from 'axios';

export const HubspotIntegration = ({ user, org, integrationParams, setIntegrationParams }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        setIsConnected(integrationParams?.type === 'HubSpot' && integrationParams?.credentials ? true : false);
    }, [integrationParams]);

    const handleConnectClick = async () => {
        setIsConnecting(true);
        try {
            const formData = new FormData();
            // user and org props are direct string IDs/names from integration-form.js
            formData.append('user_id', user);
            formData.append('org_id', org);

            const response = await axios.post("http://localhost:8000/integrations/hubspot/authorize", formData);
            // The backend returns the authorization URL directly as a string in the response data.
            const authURL = response.data; 
            if (authURL) {
                const newWindow = window.open(authURL, 'HubSpot Authorization', 'width=600,height=700');
                const timer = window.setInterval(() => {
                    if (newWindow.closed) {
                        window.clearInterval(timer);
                        handleWindowClosed();
                    }
                }, 1000); // Check every second
            } else {
                alert('Error: Could not get authorization URL.');
                setIsConnecting(false);
            }
        } catch (error) {
            console.error('Error initiating HubSpot connection:', error);
            alert('Failed to initiate HubSpot connection. See console for details.');
            setIsConnecting(false);
        }
    };

    const handleWindowClosed = async () => {
        // setIsConnecting(true) is typically already true from handleConnectClick or should be set if this can be called independently.
        if (!isConnecting) setIsConnecting(true); 
        try {
            const formData = new FormData();
            formData.append('user_id', user);
            formData.append('org_id', org);

            // Use POST for /credentials endpoint as per instructions (similar to airtable.js)
            const response = await axios.post('http://localhost:8000/integrations/hubspot/credentials', formData);
            
            if (response.data && response.data.access_token) { // Check for access_token as a sign of valid credentials
                setIsConnected(true);
                setIntegrationParams(prev => ({ 
                    ...prev, 
                    credentials: response.data, 
                    type: 'HubSpot' 
                }));
                alert('HubSpot connected successfully!');
            } else {
                // This case might occur if credentials are not found, or an error structure is returned
                console.warn('HubSpot credentials not found or incomplete after callback:', response.data);
                alert('Could not retrieve HubSpot credentials. Please try connecting again.');
                setIsConnected(false); // Ensure UI reflects the failed connection
            }
        } catch (error) {
            console.error('Error fetching HubSpot credentials:', error);
            let errorMessage = 'Failed to fetch HubSpot credentials.';
            if (error.response && error.response.data && error.response.data.detail) {
                errorMessage += ` Server said: ${error.response.data.detail}`;
            }
            alert(errorMessage);
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px dashed grey', borderRadius: '4px' }}>
            <Button
                variant="contained"
                onClick={handleConnectClick}
                disabled={isConnected || isConnecting}
                sx={{
                    backgroundColor: isConnected ? 'green' : (isConnecting ? undefined : 'primary.main'),
                    '&:hover': {
                        backgroundColor: isConnected ? 'darkgreen' : (isConnecting ? undefined : 'primary.dark'),
                    },
                }}
            >
                {isConnecting ? (
                    <CircularProgress size={24} color="inherit" />
                ) : isConnected ? (
                    'HubSpot Connected'
                ) : (
                    'Connect to HubSpot'
                )}
                {isConnecting && <span style={{ marginLeft: '8px' }}> Connecting...</span>}
            </Button>
            {isConnected && (
                 <Box sx={{ mt: 1, fontSize: '0.9em', color: 'green' }}>
                    HubSpot integration is active.
                </Box>
            )}
        </Box>
    );
};

/*Ensure it's usable in other parts of the frontend export default HubspotIntegration; 
Default export might be more conventional for components but the prompt asked for named export.
*/


