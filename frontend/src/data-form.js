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
    // State to manage loading status for the HubSpot data fetching button
    const [isLoadingItems, setIsLoadingItems] = useState(false);
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

    // Handles fetching HubSpot items from the backend and logging them to the console
    const handleLoadHubspotItems = async () => {
      // Set loading state to true to disable button and show loading indicator
      setIsLoadingItems(true);
      console.log("Loading HubSpot items..."); // Log initiation

      try {
        const formData = new FormData();
        // Credentials from props need to be stringified for the backend
        formData.append('credentials', JSON.stringify(credentials));

        // API call to the specific backend endpoint for HubSpot items
        const response = await axios.post('http://localhost:8000/integrations/hubspot/get_hubspot_items', formData);

        // Log success and the fetched data to the console
        console.log("HubSpot Items Loaded:", response.data);
        alert('HubSpot items loaded! Check the console.'); // User feedback
      } catch (error) {
        // Log error details and inform the user
        console.error("Error loading HubSpot items:", error.response ? error.response.data : error.message);
        alert(`Error loading HubSpot items. ${error.response?.data?.detail || 'Check console for details.'}`);
      } finally {
        // Reset loading state regardless of outcome
        setIsLoadingItems(false);
      }
    };

    return (
        <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
            <Box display='flex' flexDirection='column' width='100%'>
                {/* Fallback to generic data loading for other integration types (Notion, Airtable) */}
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

                {/* Conditional rendering: Show HubSpot-specific button only if HubSpot integration is active */}
                {integrationType === 'HubSpot' && (
                    <Button
                        variant="contained"
                        sx={{ mt: 2 }}
                        onClick={handleLoadHubspotItems}
                        disabled={isLoadingItems} // Disable button while loading
                    >
                        {/* Change button text based on loading state */}
                        {isLoadingItems ? 'Loading HubSpot Data...' : 'Load HubSpot Data (to Console)'}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
