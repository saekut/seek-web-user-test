// Example study used to seed local demo mode and the "Start from demo" button.
window.DEMO_STUDY = {
 "title": "SEEk website — demo test",
 "intro": "Thanks for helping! You'll try a few short tasks on an early website design. There are no wrong answers — we're testing the design, not you. Think out loud if you like.",
 "fields": [
  {
   "id": "name",
   "label": "Your name",
   "type": "text",
   "required": true
  },
  {
   "id": "age",
   "label": "Age",
   "type": "number",
   "required": false
  },
  {
   "id": "visited",
   "label": "Have you visited a science museum this year?",
   "type": "select",
   "options": [
    "Yes",
    "No"
   ],
   "required": false
  }
 ],
 "tasks": [
  {
   "id": "t1",
   "title": "Book a visit",
   "prompt": "You want to bring your family this Saturday. Book a visit.",
   "goal": "confirmed"
  },
  {
   "id": "t2",
   "title": "Find the ocean exhibit",
   "prompt": "Find the exhibit that is about plastic in the ocean.",
   "goal": "exhibit-ocean"
  }
 ],
 "ratingQuestion": "How easy was this task?",
 "devices": {
  "mobile": {
   "label": "Phone",
   "start": "home",
   "screens": [
    {
     "id": "home",
     "name": "Home",
     "image": "screens/mobile-home.svg",
     "width": 390,
     "height": 1320,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 16,
       "y": 440,
       "w": 358,
       "h": 52,
       "to": "exhibits"
      },
      {
       "x": 16,
       "y": 506,
       "w": 358,
       "h": 52,
       "to": "visit"
      },
      {
       "x": 40,
       "y": 1070,
       "w": 310,
       "h": 56,
       "to": "book"
      }
     ]
    },
    {
     "id": "exhibits",
     "name": "Exhibits",
     "image": "screens/mobile-exhibits.svg",
     "width": 390,
     "height": 900,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 280,
       "y": 14,
       "w": 94,
       "h": 36,
       "to": "home"
      },
      {
       "x": 16,
       "y": 300,
       "w": 358,
       "h": 150,
       "to": "exhibit-ocean"
      }
     ]
    },
    {
     "id": "exhibit-ocean",
     "name": "Ocean Plastic Lab",
     "image": "screens/mobile-exhibit-ocean.svg",
     "width": 390,
     "height": 980,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 280,
       "y": 14,
       "w": 94,
       "h": 36,
       "to": "exhibits"
      },
      {
       "x": 16,
       "y": 700,
       "w": 358,
       "h": 56,
       "to": "book"
      }
     ]
    },
    {
     "id": "visit",
     "name": "Plan your visit",
     "image": "screens/mobile-visit.svg",
     "width": 390,
     "height": 1000,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 280,
       "y": 14,
       "w": 94,
       "h": 36,
       "to": "home"
      },
      {
       "x": 16,
       "y": 760,
       "w": 358,
       "h": 56,
       "to": "book"
      }
     ]
    },
    {
     "id": "book",
     "name": "Book a visit",
     "image": "screens/mobile-book.svg",
     "width": 390,
     "height": 844,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 280,
       "y": 14,
       "w": 94,
       "h": 36,
       "to": "home"
      },
      {
       "x": 16,
       "y": 460,
       "w": 358,
       "h": 56,
       "to": "confirmed"
      }
     ]
    },
    {
     "id": "confirmed",
     "name": "Booking confirmed",
     "image": "screens/mobile-confirmed.svg",
     "width": 390,
     "height": 844,
     "hotspots": [
      {
       "x": 16,
       "y": 14,
       "w": 90,
       "h": 36,
       "to": "home"
      },
      {
       "x": 16,
       "y": 480,
       "w": 358,
       "h": 52,
       "to": "home"
      }
     ]
    }
   ]
  },
  "desktop": {
   "label": "Computer",
   "start": "home",
   "screens": [
    {
     "id": "home",
     "name": "Home",
     "image": "screens/desktop-home.svg",
     "width": 1440,
     "height": 1500,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      }
     ]
    },
    {
     "id": "exhibits",
     "name": "Exhibits",
     "image": "screens/desktop-exhibits.svg",
     "width": 1440,
     "height": 1100,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      },
      {
       "x": 730,
       "y": 190,
       "w": 670,
       "h": 390,
       "to": "exhibit-ocean"
      }
     ]
    },
    {
     "id": "exhibit-ocean",
     "name": "Ocean Plastic Lab",
     "image": "screens/desktop-exhibit-ocean.svg",
     "width": 1440,
     "height": 1100,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      },
      {
       "x": 900,
       "y": 460,
       "w": 300,
       "h": 56,
       "to": "book"
      }
     ]
    },
    {
     "id": "visit",
     "name": "Plan your visit",
     "image": "screens/desktop-visit.svg",
     "width": 1440,
     "height": 1000,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      },
      {
       "x": 40,
       "y": 570,
       "w": 260,
       "h": 56,
       "to": "book"
      }
     ]
    },
    {
     "id": "book",
     "name": "Book a visit",
     "image": "screens/desktop-book.svg",
     "width": 1440,
     "height": 900,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      },
      {
       "x": 40,
       "y": 540,
       "w": 300,
       "h": 56,
       "to": "confirmed"
      }
     ]
    },
    {
     "id": "confirmed",
     "name": "Booking confirmed",
     "image": "screens/desktop-confirmed.svg",
     "width": 1440,
     "height": 900,
     "hotspots": [
      {
       "x": 40,
       "y": 20,
       "w": 110,
       "h": 40,
       "to": "home"
      },
      {
       "x": 880,
       "y": 20,
       "w": 140,
       "h": 40,
       "to": "exhibits"
      },
      {
       "x": 1030,
       "y": 20,
       "w": 160,
       "h": 40,
       "to": "visit"
      },
      {
       "x": 1220,
       "y": 18,
       "w": 180,
       "h": 44,
       "to": "book"
      },
      {
       "x": 570.0,
       "y": 600,
       "w": 300,
       "h": 56,
       "to": "home"
      }
     ]
    }
   ]
  }
 }
};
