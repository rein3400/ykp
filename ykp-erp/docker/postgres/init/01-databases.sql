-- Executed by postgres:17-alpine initdb as the postgres superuser.
-- The docker-compose environment sets POSTGRES_DB=postgres so this script
-- runs with superuser privileges and can create additional databases.
CREATE DATABASE ykp_master;
CREATE DATABASE ykp_hr;
CREATE DATABASE ykp_finance;
CREATE DATABASE ykp_hermez;