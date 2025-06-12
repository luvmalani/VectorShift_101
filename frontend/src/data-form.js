import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
    'Notion': 'notion',
    'Airtable': 'airtable',
};

export const DataForm = ({ integrationType, credentials }) => {
    const [loadedData, setLoadedData] = useState(null);
    const [isLoadingItems, setIsLoadingItems] = useState(false); // For HubSpot specific loading
    const endpoint = endpointMapping[integrationType];

    // Generic load for Notion, Airtable
    const handleGenericLoad = async () => {
        if (!endpoint) {
            alert("Integration type not supported for generic load.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));
            const response = await axios.post(`http://localhost:8000/integrations/${endpoint}/load`, formData);
            const data = response.data;
            setLoadedData(JSON.stringify(data, null, 2)); // Pretty print JSON
        } catch (e) {
            alert(e?.response?.data?.detail || 'Error loading data.');
        }
    }

    const handleLoadHubspotItems = async () => {
        setIsLoadingItems(true);
        console.log("Loading HubSpot items...");
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials)); // credentials prop is an object

            // Endpoint specific to HubSpot for getting items
            const response = await axios.post('http://localhost:8000/integrations/hubspot/get_hubspot_items', formData);

            console.log("HubSpot Items Loaded:", response.data);
            alert('HubSpot items loaded! Check the console.');
            // Optionally, you could set some state here if you want to display a confirmation or item count
            // For now, just logging as per requirement.
        } catch (error) {
            console.error('Error loading HubSpot items:', error);
            let errorMessage = 'Error loading HubSpot items.';
            if (error.response && error.response.data && error.response.data.detail) {
                errorMessage += ` Server said: ${error.response.data.detail}`;
            }
            alert(errorMessage + ' Check console for details.');
        } finally {
            setIsLoadingItems(false);
        }
    };

    return (
        <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
            <Box display='flex' flexDirection='column' width='100%'>
                {integrationType !== 'HubSpot' && (
                    <>
                        <TextField
                            label="Loaded Data"
                            value={loadedData || ''}
                            sx={{mt: 2}}
                            InputLabelProps={{ shrink: true }}
                            disabled
                            multiline
                            rows={4}
                        />
                        <Button
                            onClick={handleGenericLoad}
                            sx={{mt: 2}}
                            variant='contained'
                        >
                            Load Data
                        </Button>
                        <Button
                            onClick={() => setLoadedData(null)}
                            sx={{mt: 1}}
                            variant='contained'
                        >
                            Clear Data
                        </Button>
                    </>
                )}

                {integrationType === 'HubSpot' && (
                    <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={handleLoadHubspotItems}
                        disabled={isLoadingItems}
                    >
                        {isLoadingItems ? 'Loading HubSpot Data...' : 'Load HubSpot Data (to Console)'}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
