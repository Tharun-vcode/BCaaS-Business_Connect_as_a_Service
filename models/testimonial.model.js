const db = require('../database');
const DataTypes = require('sequelize');

const Testimonial = db.define(
    'Testimonial',
    {
        testimonialId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        testimonial: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        tableName: 'testimonial',
        underscored: true,
    }
);
  
  
module.exports = Testimonial;
