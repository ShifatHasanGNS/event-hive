module.exports = `Database: EventHive (PostgreSQL)

Tables and columns:
- users
  - user_id SERIAL PRIMARY KEY
  - email VARCHAR UNIQUE NOT NULL
  - password_hash VARCHAR NOT NULL
  - full_name VARCHAR NOT NULL
  - phone VARCHAR
  - role VARCHAR CHECK (organizer|attendee|admin)
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

- events
  - event_id SERIAL PRIMARY KEY
  - organizer_id INTEGER REFERENCES users(user_id)
  - title VARCHAR NOT NULL
  - description TEXT
  - category VARCHAR CHECK (technology|business|education|sports|music|arts|health|other)
  - location VARCHAR NOT NULL
  - venue_name VARCHAR
  - event_date DATE NOT NULL
  - start_time TIME NOT NULL
  - end_time TIME NOT NULL
  - capacity INTEGER CHECK (>0)
  - ticket_price DECIMAL CHECK (>=0)
  - status VARCHAR CHECK (upcoming|ongoing|completed|cancelled)
  - created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

- registrations
  - registration_id SERIAL PRIMARY KEY
  - event_id INTEGER REFERENCES events(event_id)
  - user_id INTEGER REFERENCES users(user_id)
  - registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - status VARCHAR CHECK (confirmed|cancelled|waitlist|attended)
  - payment_status VARCHAR CHECK (pending|completed|refunded|failed)
  - payment_amount DECIMAL
  - booking_reference VARCHAR UNIQUE
  - UNIQUE (event_id, user_id)

- event_feedback
  - feedback_id SERIAL PRIMARY KEY
  - event_id INTEGER REFERENCES events(event_id)
  - user_id INTEGER REFERENCES users(user_id)
  - rating INTEGER CHECK BETWEEN 1 AND 5
  - comment TEXT
  - submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  - UNIQUE (event_id, user_id)

- event_tags
  - tag_id SERIAL PRIMARY KEY
  - event_id INTEGER REFERENCES events(event_id)
  - tag_name VARCHAR NOT NULL
  - UNIQUE (event_id, tag_name)

Indexes: users(email, role); events(date, category, status, location, organizer_id+event_date); registrations(event_id+status, user_id, payment_status); event_feedback(event_id+rating, user_id); event_tags(tag_name, event_id+tag_name).

Sample data: 7 users, 10 events, 20 registrations, 9 feedback rows, 30+ tags.

Always generate SQL compatible with PostgreSQL 15+. Use available data when demonstrating queries.`;
