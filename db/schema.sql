-- ============================================
-- EventHive Database Schema
-- PostgreSQL (Neon-DB Compatible)
-- ============================================
-- ============================================
-- Table 1: USERS
-- ============================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('organizer', 'attendee', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
COMMENT ON TABLE users IS 'Stores all system users - organizers and attendees';
COMMENT ON COLUMN users.role IS 'User type: organizer (creates events), attendee (registers), admin';
-- ============================================
-- Table 2: EVENTS
-- ============================================
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (
        category IN (
            'technology',
            'business',
            'education',
            'sports',
            'music',
            'arts',
            'health',
            'other'
        )
    ),
    location VARCHAR(255) NOT NULL,
    venue_name VARCHAR(150),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    ticket_price DECIMAL(10, 2) DEFAULT 0.00 CHECK (ticket_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (
        status IN ('upcoming', 'ongoing', 'completed', 'cancelled')
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_organizer FOREIGN KEY (organizer_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_location ON events(location);
CREATE INDEX idx_events_organizer_date ON events(organizer_id, event_date);
COMMENT ON TABLE events IS 'Main events table storing all event information';
COMMENT ON COLUMN events.capacity IS 'Maximum number of attendees allowed';
-- ============================================
-- Table 3: REGISTRATIONS
-- ============================================
CREATE TABLE registrations (
    registration_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (
        status IN ('confirmed', 'cancelled', 'waitlist', 'attended')
    ),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        payment_status IN ('pending', 'completed', 'refunded', 'failed')
    ),
    payment_amount DECIMAL(10, 2),
    booking_reference VARCHAR(50) UNIQUE,
    CONSTRAINT fk_registration_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_registration_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT unique_user_event UNIQUE (event_id, user_id)
);
CREATE INDEX idx_registrations_event_status ON registrations(event_id, status);
CREATE INDEX idx_registrations_user ON registrations(user_id, registration_date DESC);
CREATE INDEX idx_registrations_payment ON registrations(payment_status);
COMMENT ON TABLE registrations IS 'Tracks user registrations/bookings for events';
-- ============================================
-- Table 4: EVENT_FEEDBACK
-- ============================================
CREATE TABLE event_feedback (
    feedback_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (
        rating >= 1
        AND rating <= 5
    ),
    comment TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT unique_user_event_feedback UNIQUE (event_id, user_id)
);
CREATE INDEX idx_feedback_event_rating ON event_feedback(event_id, rating);
CREATE INDEX idx_feedback_user ON event_feedback(user_id);
COMMENT ON TABLE event_feedback IS 'Stores ratings and reviews from attendees after events';
-- ============================================
-- Table 5: EVENT_TAGS
-- ============================================
CREATE TABLE event_tags (
    tag_id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    tag_name VARCHAR(50) NOT NULL,
    CONSTRAINT fk_tag_event FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT unique_event_tag UNIQUE (event_id, tag_name)
);
CREATE INDEX idx_tags_name ON event_tags(tag_name);
CREATE INDEX idx_tags_event ON event_tags(event_id, tag_name);
COMMENT ON TABLE event_tags IS 'Multiple tags per event for better categorization and search';
-- ============================================
-- SAMPLE DATA INSERTION
-- ============================================
-- Insert sample users
INSERT INTO users (email, password_hash, full_name, phone, role)
VALUES (
        'john.doe@email.com',
        'hash123',
        'John Doe',
        '+8801712345678',
        'organizer'
    ),
    (
        'sarah.smith@email.com',
        'hash456',
        'Sarah Smith',
        '+8801712345679',
        'organizer'
    ),
    (
        'mike.wilson@email.com',
        'hash789',
        'Mike Wilson',
        '+8801712345680',
        'attendee'
    ),
    (
        'emily.brown@email.com',
        'hash321',
        'Emily Brown',
        '+8801712345681',
        'attendee'
    ),
    (
        'david.jones@email.com',
        'hash654',
        'David Jones',
        '+8801712345682',
        'attendee'
    ),
    (
        'lisa.davis@email.com',
        'hash987',
        'Lisa Davis',
        '+8801712345683',
        'organizer'
    ),
    (
        'admin@eventhive.com',
        'adminHash',
        'Admin User',
        '+8801700000000',
        'admin'
    );
-- Insert sample events
INSERT INTO events (
        organizer_id,
        title,
        description,
        category,
        location,
        venue_name,
        event_date,
        start_time,
        end_time,
        capacity,
        ticket_price,
        status
    )
VALUES (
        1,
        'AI & Machine Learning Summit 2025',
        'Explore the latest trends in AI and ML with industry experts',
        'technology',
        'Dhaka',
        'Radisson Blu Hotel',
        '2025-12-15',
        '09:00',
        '18:00',
        200,
        1500.00,
        'upcoming'
    ),
    (
        1,
        'Web Development Bootcamp',
        'Intensive 2-day workshop on modern web technologies',
        'technology',
        'Chittagong',
        'Hotel Agrabad',
        '2025-11-20',
        '10:00',
        '17:00',
        50,
        2500.00,
        'upcoming'
    ),
    (
        2,
        'Startup Founder Meetup',
        'Network with fellow entrepreneurs and investors',
        'business',
        'Dhaka',
        'BRAC Center',
        '2025-10-25',
        '18:00',
        '21:00',
        100,
        0.00,
        'upcoming'
    ),
    (
        2,
        'Digital Marketing Masterclass',
        'Learn advanced digital marketing strategies',
        'business',
        'Dhaka',
        'Pan Pacific Sonargaon',
        '2025-11-10',
        '14:00',
        '18:00',
        80,
        1200.00,
        'upcoming'
    ),
    (
        6,
        'National Football Championship',
        'Annual inter-university football tournament',
        'sports',
        'Sylhet',
        'District Stadium',
        '2025-12-01',
        '08:00',
        '20:00',
        5000,
        200.00,
        'upcoming'
    ),
    (
        1,
        'Classical Music Night',
        'An evening of classical music performances',
        'music',
        'Dhaka',
        'National Theatre',
        '2025-10-30',
        '19:00',
        '22:00',
        300,
        500.00,
        'upcoming'
    ),
    (
        6,
        'Health & Wellness Expo',
        'Explore health products and wellness services',
        'health',
        'Dhaka',
        'ICCB',
        '2025-11-15',
        '10:00',
        '19:00',
        1000,
        0.00,
        'upcoming'
    ),
    (
        2,
        'Photography Workshop',
        'Learn professional photography techniques',
        'arts',
        'Cox''s Bazar',
        'Sea Pearl Resort',
        '2025-12-10',
        '08:00',
        '16:00',
        30,
        3000.00,
        'upcoming'
    ),
    (
        1,
        'Blockchain Technology Conference',
        'Discussing blockchain applications in Bangladesh',
        'technology',
        'Dhaka',
        'Le Méridien',
        '2025-11-25',
        '09:00',
        '17:00',
        150,
        2000.00,
        'upcoming'
    ),
    (
        6,
        'University Career Fair 2025',
        'Meet top employers and explore career opportunities',
        'education',
        'Dhaka',
        'BUET Campus',
        '2025-10-28',
        '10:00',
        '16:00',
        2000,
        0.00,
        'upcoming'
    );
-- Insert registrations
INSERT INTO registrations (
        event_id,
        user_id,
        status,
        payment_status,
        payment_amount,
        booking_reference
    )
VALUES (
        1,
        3,
        'confirmed',
        'completed',
        1500.00,
        'BK-2025-001'
    ),
    (
        1,
        4,
        'confirmed',
        'completed',
        1500.00,
        'BK-2025-002'
    ),
    (
        1,
        5,
        'confirmed',
        'completed',
        1500.00,
        'BK-2025-003'
    ),
    (
        2,
        3,
        'confirmed',
        'pending',
        2500.00,
        'BK-2025-004'
    ),
    (
        2,
        4,
        'confirmed',
        'completed',
        2500.00,
        'BK-2025-005'
    ),
    (
        3,
        3,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-006'
    ),
    (
        3,
        4,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-007'
    ),
    (
        3,
        5,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-008'
    ),
    (
        4,
        3,
        'cancelled',
        'refunded',
        1200.00,
        'BK-2025-009'
    ),
    (
        5,
        4,
        'confirmed',
        'completed',
        200.00,
        'BK-2025-010'
    ),
    (
        5,
        5,
        'confirmed',
        'completed',
        200.00,
        'BK-2025-011'
    ),
    (
        6,
        3,
        'confirmed',
        'completed',
        500.00,
        'BK-2025-012'
    ),
    (
        7,
        3,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-013'
    ),
    (
        7,
        4,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-014'
    ),
    (
        7,
        5,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-015'
    ),
    (
        8,
        3,
        'waitlist',
        'pending',
        3000.00,
        'BK-2025-016'
    ),
    (
        9,
        4,
        'confirmed',
        'completed',
        2000.00,
        'BK-2025-017'
    ),
    (
        10,
        3,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-018'
    ),
    (
        10,
        4,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-019'
    ),
    (
        10,
        5,
        'confirmed',
        'completed',
        0.00,
        'BK-2025-020'
    );
-- Insert feedback
INSERT INTO event_feedback (event_id, user_id, rating, comment)
VALUES (
        1,
        3,
        5,
        'Excellent speakers and great networking opportunities!'
    ),
    (
        1,
        4,
        5,
        'Very informative sessions on AI trends'
    ),
    (2, 4, 4, 'Good hands-on workshop, learned a lot'),
    (
        3,
        3,
        4,
        'Great networking event, met interesting people'
    ),
    (
        3,
        5,
        5,
        'Perfect for startup founders, highly recommend'
    ),
    (
        5,
        4,
        3,
        'Good matches but organization could be better'
    ),
    (
        6,
        3,
        5,
        'Beautiful performances, worth every penny'
    ),
    (
        7,
        3,
        4,
        'Wide variety of health products on display'
    ),
    (7, 4, 4, 'Informative and well-organized expo');
-- Insert tags
INSERT INTO event_tags (event_id, tag_name)
VALUES (1, 'artificial-intelligence'),
    (1, 'machine-learning'),
    (1, 'networking'),
    (1, 'tech-conference'),
    (2, 'web-development'),
    (2, 'workshop'),
    (2, 'hands-on'),
    (2, 'beginner-friendly'),
    (3, 'startup'),
    (3, 'entrepreneurship'),
    (3, 'networking'),
    (3, 'free'),
    (4, 'marketing'),
    (4, 'digital'),
    (4, 'business-growth'),
    (5, 'football'),
    (5, 'sports'),
    (5, 'tournament'),
    (5, 'outdoor'),
    (6, 'music'),
    (6, 'classical'),
    (6, 'cultural'),
    (7, 'health'),
    (7, 'wellness'),
    (7, 'exhibition'),
    (7, 'free'),
    (8, 'photography'),
    (8, 'arts'),
    (8, 'workshop'),
    (8, 'creative'),
    (9, 'blockchain'),
    (9, 'cryptocurrency'),
    (9, 'technology'),
    (9, 'conference'),
    (10, 'career'),
    (10, 'jobs'),
    (10, 'students'),
    (10, 'free');
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
SELECT 'users' AS table_name,
    COUNT(*) AS row_count
FROM users
UNION ALL
SELECT 'events',
    COUNT(*)
FROM events
UNION ALL
SELECT 'registrations',
    COUNT(*)
FROM registrations
UNION ALL
SELECT 'event_feedback',
    COUNT(*)
FROM event_feedback
UNION ALL
SELECT 'event_tags',
    COUNT(*)
FROM event_tags;