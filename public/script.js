// Client-side script to populate the dropdown and draw charts using Chart.js.
// This file runs in the browser and communicates with the Express API
// provided by app.js.  It fetches historical data for a selected universe
// ID and renders four charts: visits, concurrent players, and their
// respective growth percentages.

/* global Chart */

document.addEventListener('DOMContentLoaded', async () => {
  const gameSelect = document.getElementById('gameSelect');
  let visitsChart;
  let playingChart;
  let visitsGrowthChart;
  let playingGrowthChart;

  // Fetch the list of available game IDs from the API.  The API returns an
  // object keyed by universe ID, each mapping to an array of entries.  We
  // extract the keys to build the dropdown.
  async function loadGameIds() {
    const response = await fetch('/api/data');
    const allData = await response.json();
    return Object.keys(allData);
  }

  // Fetch data for a single game/universe ID.
  async function fetchGameData(id) {
    const response = await fetch(`/api/data/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data for universe ${id}: ${response.status}`);
    }
    const data = await response.json();
    // Ensure the array is sorted by timestamp
    return data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // Render the charts for the selected game.  Any existing charts are
  // destroyed before creating new ones to free memory and avoid overlaying
  // multiple charts on the same canvas elements.
  function renderCharts(entries) {
    const labels = entries.map(entry => {
      const date = new Date(entry.timestamp);
      return date.toLocaleString();
    });
    const visits = entries.map(entry => entry.visits);
    const playing = entries.map(entry => entry.playing);
    const visitsGrowth = entries.map(entry => entry.visitsGrowth);
    const playingGrowth = entries.map(entry => entry.playingGrowth);

    // Destroy existing charts if they exist
    visitsChart?.destroy();
    playingChart?.destroy();
    visitsGrowthChart?.destroy();
    playingGrowthChart?.destroy();

    const visitsCtx = document.getElementById('visitsChart').getContext('2d');
    visitsChart = new Chart(visitsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Visits',
            data: visits,
            borderColor: 'rgba(54, 162, 235, 1)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Total visits',
            },
            beginAtZero: true,
          },
        },
      },
    });

    const playingCtx = document.getElementById('playingChart').getContext('2d');
    playingChart = new Chart(playingCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Current players',
            data: playing,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Players',
            },
            beginAtZero: true,
          },
        },
      },
    });

    const visitsGrowthCtx = document.getElementById('visitsGrowthChart').getContext('2d');
    visitsGrowthChart = new Chart(visitsGrowthCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Visits growth (%)',
            data: visitsGrowth,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Growth (%)',
            },
            beginAtZero: true,
          },
        },
      },
    });

    const playingGrowthCtx = document.getElementById('playingGrowthChart').getContext('2d');
    playingGrowthChart = new Chart(playingGrowthCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Players growth (%)',
            data: playingGrowth,
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Growth (%)',
            },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // When the user changes the selected game, fetch its data and re-render
  gameSelect.addEventListener('change', async (e) => {
    const id = e.target.value;
    try {
      const entries = await fetchGameData(id);
      renderCharts(entries);
    } catch (err) {
      console.error(err);
    }
  });

  // Populate the select element and draw the initial charts.  We select
  // the first universe by default if one exists.
  try {
    const ids = await loadGameIds();
    ids.forEach((id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = id;
      gameSelect.appendChild(option);
    });
    if (ids.length > 0) {
      gameSelect.value = ids[0];
      const initialData = await fetchGameData(ids[0]);
      renderCharts(initialData);
    }
  } catch (err) {
    console.error('Failed to load game IDs or render charts:', err);
  }
});