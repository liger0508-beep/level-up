-- role_permissions 테이블 제약조건 업데이트
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_check CHECK (role IN ('admin', 'office', 'headquarter', 'coach', 'athlete', 'parent'));

-- users 테이블 제약조건 업데이트
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'office', 'headquarter', 'coach', 'athlete', 'parent'));
