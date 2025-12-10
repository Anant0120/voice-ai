

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_8d7d1ffa5c095d927021459abf1ae59ae66367acc25a85bf';

async function getVoices() {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    
    
    if (data.voices && data.voices.length > 0) {
      data.voices.forEach((voice, index) => {
        console.log(`${index + 1}. ${voice.name}`);
        console.log(`   Voice ID: ${voice.voice_id}`);
        console.log(`   Category: ${voice.category || 'N/A'}`);
        console.log(`   Description: ${voice.description || 'N/A'}`);
        console.log('');
      });
      
      console.log('\n=== How to Use ===');
      console.log('Copy a Voice ID above and add it to your .env file:');
      console.log('VITE_ELEVENLABS_VOICE_ID=your_voice_id_here\n');
    } else {
      console.log('No voices found in your account.');
    }
  } catch (error) {
    console.error('Error fetching voices:', error.message);
    console.log('\nMake sure your ELEVENLABS_API_KEY is set correctly.');
  }
}

getVoices();

